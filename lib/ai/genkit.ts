import { genkit } from 'genkit';
import { googleAI, gemini } from '@genkit-ai/googleai';
import { apiKeyManager } from './api-key-manager';

export const DEFAULT_CHAT_MODEL_IDS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
] as const;

const DEPRECATED_CHAT_MODEL_IDS = new Set([
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite-preview',
]);

type EnvLike = Partial<Record<'GEMINI_MODEL_ID' | 'GEMINI_MODEL_IDS', string | undefined>>;

function parseModelIds(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((modelId) => modelId.trim())
        .filter((modelId) => modelId.length > 0 && !DEPRECATED_CHAT_MODEL_IDS.has(modelId)),
    ),
  ];
}

export function getChatModelIds(env?: EnvLike): string[] {
  const source = env ?? {
    GEMINI_MODEL_ID: process.env.GEMINI_MODEL_ID,
    GEMINI_MODEL_IDS: process.env.GEMINI_MODEL_IDS,
  };
  const configuredModels = parseModelIds(source.GEMINI_MODEL_IDS);
  if (configuredModels.length > 0) return configuredModels;

  const configuredPrimary = source.GEMINI_MODEL_ID?.trim();
  if (configuredPrimary && !DEPRECATED_CHAT_MODEL_IDS.has(configuredPrimary)) {
    return [
      configuredPrimary,
      ...DEFAULT_CHAT_MODEL_IDS.filter((modelId) => modelId !== configuredPrimary),
    ];
  }

  return [...DEFAULT_CHAT_MODEL_IDS];
}

export const CHAT_MODEL_IDS = getChatModelIds();
export const CHAT_MODEL_ID = CHAT_MODEL_IDS[0];

const createGenkit = (apiKey: string, modelId = CHAT_MODEL_ID) => {
  return genkit({
    plugins: [googleAI({ apiKey, models: [modelId] })],
    model: gemini(modelId),
  });
};

export function shouldTryNextChatModel(error: unknown): boolean {
  const err = error as { status?: number; message?: string; response?: { status?: number } };
  const status = err?.status ?? err?.response?.status;
  const message = err?.message?.toLowerCase() ?? '';

  if (status === 404 || status === 429 || (status !== undefined && status >= 500)) {
    return true;
  }

  return [
    'model',
    'quota',
    'rate limit',
    'too many requests',
    'timeout',
    'etimedout',
    'network',
    'econnrefused',
    'unavailable',
    'max retries',
  ].some((pattern) => message.includes(pattern));
}

export async function runWithKeyRotation<T>(
  operation: (ai: ReturnType<typeof createGenkit>) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  const attemptBudget = { remaining: 6 };

  for (const modelId of CHAT_MODEL_IDS) {
    try {
      return await runWithKeyRotationForModel(operation, modelId, 'Genkit operation', attemptBudget);
    } catch (error: unknown) {
      lastError = error;

      if (
        isAttemptBudgetExceeded(error) ||
        !shouldTryNextChatModel(error) ||
        modelId === CHAT_MODEL_IDS[CHAT_MODEL_IDS.length - 1]
      ) {
        throw error;
      }

      console.warn(`Genkit model ${modelId} failed, retrying with fallback model...`);
    }
  }

  throw lastError;
}

async function runWithKeyRotationForModel<T>(
  operation: (ai: ReturnType<typeof createGenkit>) => Promise<T>,
  modelId: string,
  label: string,
  attemptBudget: { remaining: number },
): Promise<T> {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    if (attemptBudget.remaining <= 0) {
      throw new Error(`Max retries exceeded for ${label}`);
    }

    let currentKey = '';
    try {
      currentKey = apiKeyManager.getNextKey();
      const ai = createGenkit(currentKey, modelId);
      attempts++;
      attemptBudget.remaining--;
      return await operation(ai);
    } catch (error: unknown) {
      const isRateLimit = isRateLimitError(error);

      if (isRateLimit && currentKey) {
        console.warn(`${label} failed with rate limit for model ${modelId} and key ending in ...${currentKey.slice(-4)}, retrying...`);
        apiKeyManager.markKeyFailed(currentKey, getRateLimitFailureKind(error));
        if (attempts < maxRetries && attemptBudget.remaining > 0) {
          await wait(getBackoffDelayMs(attempts));
        }
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Max retries exceeded for ${label} with model ${modelId}`);
}

export async function streamWithKeyRotation<T>(
  operation: (ai: ReturnType<typeof createGenkit>) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  const attemptBudget = { remaining: 6 };

  for (const modelId of CHAT_MODEL_IDS) {
    try {
      return await runWithKeyRotationForModel(operation, modelId, 'Genkit streaming operation', attemptBudget);
    } catch (error: unknown) {
      lastError = error;

      if (
        isAttemptBudgetExceeded(error) ||
        !shouldTryNextChatModel(error) ||
        modelId === CHAT_MODEL_IDS[CHAT_MODEL_IDS.length - 1]
      ) {
        throw error;
      }

      console.warn(`Genkit streaming model ${modelId} failed, retrying with fallback model...`);
    }
  }

  throw lastError;
}

function isRateLimitError(error: unknown): boolean {
  const err = error as { status?: number; message?: string; response?: { status?: number } };
  const message = err?.message?.toLowerCase() ?? '';
  return (
    err?.status === 429 ||
    err?.response?.status === 429 ||
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
}

export function getRateLimitFailureKind(error: unknown): 'rpm' | 'rpd' {
  const message = (error as { message?: string })?.message ?? '';
  return /perday|per day|daily/i.test(message) ? 'rpd' : 'rpm';
}

function isAttemptBudgetExceeded(error: unknown): boolean {
  return (error as { message?: string })?.message?.startsWith('Max retries exceeded') ?? false;
}

function getBackoffDelayMs(attempt: number): number {
  const base = [250, 500, 1000][Math.min(attempt - 1, 2)];
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.round(base * jitter);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
