import { z } from "zod";

export const CHAT_REQUEST_MAX_BYTES = 32 * 1024;
export const CHAT_MESSAGE_MAX_CHARS = 250;
export const CHAT_HISTORY_MAX_ENTRIES = 6;
export const CHAT_HISTORY_MAX_CHARS = 1_200;
export const CHAT_SUMMARY_MAX_CHARS = 1_200;

const UNSAFE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const PUBLIC_VALIDATION_MESSAGE = "Send a valid chat request.";

const boundedText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !UNSAFE_CONTROL_CHARACTERS.test(value));

const ChatRequestSchema = z.object({
  message: boundedText(CHAT_MESSAGE_MAX_CHARS),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: boundedText(CHAT_HISTORY_MAX_CHARS),
      }),
    )
    .max(CHAT_HISTORY_MAX_ENTRIES)
    .default([]),
  summary: boundedText(CHAT_SUMMARY_MAX_CHARS).optional(),
  conversationId: z.string().uuid().optional(),
  streaming: z.boolean().default(false),
});

export type ParsedChatRequest = z.infer<typeof ChatRequestSchema>;

export class ChatRequestError extends Error {
  readonly status: number;
  readonly publicMessage: string;

  constructor(status: number, publicMessage = PUBLIC_VALIDATION_MESSAGE) {
    super(publicMessage);
    this.name = "ChatRequestError";
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new ChatRequestError(400);
    }
    if (parsedLength > CHAT_REQUEST_MAX_BYTES) {
      throw new ChatRequestError(413);
    }
  }

  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > CHAT_REQUEST_MAX_BYTES) {
        await reader.cancel();
        throw new ChatRequestError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function parseChatRequest(
  request: Request,
): Promise<{ data: ParsedChatRequest; byteLength: number }> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ChatRequestError(415);
  }

  const body = await readBoundedBody(request);
  let decoded: string;
  let input: unknown;

  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(body);
    input = JSON.parse(decoded);
  } catch {
    throw new ChatRequestError(400);
  }

  const parsed = ChatRequestSchema.safeParse(input);
  if (!parsed.success) throw new ChatRequestError(400);

  return { data: parsed.data, byteLength: body.byteLength };
}

export function getTrustedClientIp(headers: Headers): string {
  return (
    headers.get("x-vercel-forwarded-for")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    (process.env.NODE_ENV === "development" ? "127.0.0.1" : "unknown")
  );
}
