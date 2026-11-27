import assert from "node:assert/strict";
import test, { mock, type TestContext } from "node:test";
import type { ChatState, ChatMessage } from "../../lib/types";

type Frame = Record<string, unknown>;

let state: ChatState | undefined;
let refIndex = 0;
const refs: Array<{ current: unknown }> = [];
let effectIndex = 0;
let pendingEffects: Array<() => void> = [];
const priorEffectDeps: unknown[][] = [];

mock.module("react", {
  namedExports: {
    useCallback: (callback: unknown) => callback,
    useRef(value: unknown) {
      const index = refIndex++;
      return (refs[index] ??= { current: value });
    },
    useState(initial: ChatState) {
      state ??= initial;
      return [state, (next: ChatState | ((previous: ChatState) => ChatState)) => {
        state = typeof next === "function" ? next(state!) : next;
      }];
    },
    useEffect(effect: () => void, deps: unknown[]) {
      const index = effectIndex++;
      if (!priorEffectDeps[index] || deps.some((value, j) => !Object.is(value, priorEffectDeps[index][j]))) {
        priorEffectDeps[index] = deps;
        pendingEffects.push(effect);
      }
    },
  },
});

const hookModule = import("../../hooks/use-chat.ts");

function render(invokeHook: Awaited<typeof hookModule>["useChat"]) {
  refIndex = 0;
  effectIndex = 0;
  const hook = invokeHook();
  const effects = pendingEffects;
  pendingEffects = [];
  effects.forEach((effect) => effect());
  return hook;
}

function setup(t: TestContext, responses: Array<Frame[] | { frames: Frame[]; failAfterFrames: true }>) {
  state = undefined;
  refs.length = 0;
  priorEffectDeps.length = 0;
  pendingEffects = [];

  const saved = new Map<string, string>();
  const requests: Array<{ history: Array<{ role: string; content: string }> }> = [];
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) },
    configurable: true,
  });
  t.after(() => {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    assert.equal(input, "/api/chat");
    const response = responses[requests.length];
    assert.ok(response, "an unexpected request was made");
    requests.push(JSON.parse(String(init.body)));
    const frames = Array.isArray(response) ? response : response.frames;
    let index = 0;
    return new Response(new ReadableStream({
      pull(controller) {
        if (index < frames.length) {
          controller.enqueue(new TextEncoder().encode("data: " + JSON.stringify(frames[index++]) + "\n\n"));
        } else if (Array.isArray(response)) {
          controller.close();
        } else {
          controller.error(new Error("Synthetic transport closed after final"));
        }
      },
    }, { highWaterMark: 0 }), { headers: { "Content-Type": "text/event-stream" } });
  });
  const storedAssistant = () => (JSON.parse(saved.get("vsu-smartmap-chat") ?? "[]") as ChatMessage[])
    .filter((message) => message.role === "assistant");
  return { requests, storedAssistant };
}

const partial = { type: "chunk", content: "Synthetic partial campus answer" };
const final = {
  type: "final",
  content: "Synthetic completed campus answer",
  turnId: "test-turn",
  requestId: "test-request",
  feedbackToken: "test-feedback",
  facilities: [{ facilityId: "test-library", name: "Synthetic Library" }],
};

test("chat stream EOF without a final frame is a retryable failure", async (t) => {
  const { useChat } = await hookModule;
  const { storedAssistant } = setup(t, [[partial]]);
  assert.equal(await render(useChat).sendMessage("Find the synthetic library"), false);
  const rendered = render(useChat);
  assert.equal(rendered.isLoading, false);
  assert.equal(storedAssistant().length, 1);
  assert.equal(storedAssistant()[0].isError, true);
  assert.doesNotMatch(storedAssistant()[0].content, /partial campus answer/);
});

test("stream error replaces partial output; one successful retry stores only the final answer", async (t) => {
  const { useChat } = await hookModule;
  const { requests, storedAssistant } = setup(t, [[partial, { type: "error", error: "Synthetic interruption" }], [partial, final]]);
  assert.equal(await render(useChat).sendMessage("Find the synthetic library"), false);
  const afterError = render(useChat);
  assert.equal(storedAssistant().length, 1);
  assert.equal(storedAssistant()[0].isError, true);
  assert.equal(await afterError.retryLastMessage(), true);
  render(useChat);
  assert.deepEqual(requests[1].history, []);
  const messages = storedAssistant();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, final.content);
  assert.deepEqual(messages[0].facilities, final.facilities);
  assert.equal(messages[0].turnId, final.turnId);
  assert.equal(messages[0].requestId, final.requestId);
  assert.equal(messages[0].feedbackToken, final.feedbackToken);
});

test("malformed final does not confirm a partial reply", async (t) => {
  const { useChat } = await hookModule;
  const { storedAssistant } = setup(t, [[partial, { type: "final" }]]);
  assert.equal(await render(useChat).sendMessage("Find the synthetic library"), false);
  render(useChat);
  assert.equal(storedAssistant().length, 1);
  assert.equal(storedAssistant()[0].isError, true);
});

test("a valid final frame is terminal even if the transport later fails", async (t) => {
  const { useChat } = await hookModule;
  const { storedAssistant } = setup(t, [{ frames: [partial, final], failAfterFrames: true }]);
  assert.equal(await render(useChat).sendMessage("Find the synthetic library"), true);
  render(useChat);
  assert.equal(storedAssistant().length, 1);
  assert.equal(storedAssistant()[0].content, final.content);
  assert.equal(storedAssistant()[0].turnId, final.turnId);
});

test("a whitespace-only final does not turn the preceding chunk into a completed reply", async (t) => {
  const { useChat } = await hookModule;
  const { storedAssistant } = setup(t, [[partial, { type: "final", content: "   " }]]);
  assert.equal(await render(useChat).sendMessage("Find the synthetic library"), false);
  render(useChat);
  assert.equal(storedAssistant().length, 1);
  assert.equal(storedAssistant()[0].isError, true);
  assert.doesNotMatch(storedAssistant()[0].content, /partial campus answer/);
});
