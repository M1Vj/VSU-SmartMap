import { setTimeout as delay } from 'node:timers/promises';
import { GoogleGenAI } from '@google/genai';
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

const CHAT_ATTEMPT_BUDGET = 6;

export type GenerationRunMetadata = {
  selectedModel: string;
  attemptCount: number;
};

export function createGenerationRunMetadata(
  selectedModel: string,
  remainingAttempts: number,
): GenerationRunMetadata {
  return {
    selectedModel,
    attemptCount: Math.max(0, Math.min(CHAT_ATTEMPT_BUDGET, CHAT_ATTEMPT_BUDGET - remainingAttempts)),
  };
}

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
  operation: (sdk: GoogleGenAI, modelId: string) => Promise<T>,
  options: { signal?: AbortSignal; onSuccess?: (metadata: GenerationRunMetadata) => void } = {},
): Promise<T> {
  let lastError: unknown;
  const attemptBudget = { remaining: CHAT_ATTEMPT_BUDGET };

  for (const modelId of CHAT_MODEL_IDS) {
    options.signal?.throwIfAborted();
    try {
      const result = await runWithKeyRotationForModel(operation, modelId, attemptBudget, options.signal);
      options.signal?.throwIfAborted();
      options.onSuccess?.(createGenerationRunMetadata(modelId, attemptBudget.remaining));
      return result;
    } catch (error: unknown) {
      options.signal?.throwIfAborted();
      lastError = error;

      if (
        isAttemptBudgetExceeded(error) ||
        !shouldTryNextChatModel(error) ||
        modelId === CHAT_MODEL_IDS[CHAT_MODEL_IDS.length - 1]
      ) {
        throw error;
      }

      console.warn(`Gemini model ${modelId} failed, retrying with fallback model...`);
    }
  }

  throw lastError;
}

async function runWithKeyRotationForModel<T>(
  operation: (sdk: GoogleGenAI, modelId: string) => Promise<T>,
  modelId: string,
  attemptBudget: { remaining: number },
  signal?: AbortSignal,
): Promise<T> {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    signal?.throwIfAborted();
    if (attemptBudget.remaining <= 0) {
      throw new Error('Max retries exceeded for Gemini operation');
    }

    let currentKey = '';
    try {
      currentKey = apiKeyManager.getNextKey();
      const sdk = new GoogleGenAI({
        apiKey: currentKey,
        enterprise: false,
        apiVersion: 'v1beta',
        httpOptions: {
          // Preserve the previous Developer API destination for the rotated key.
          baseUrl: 'https://generativelanguage.googleapis.com/',
          // Keep retries and credential rotation in the app.
          retryOptions: { attempts: 1 },
        },
      });
      attempts++;
      attemptBudget.remaining--;
      return await operation(sdk, modelId);
    } catch (error: unknown) {
      signal?.throwIfAborted();
      const isRateLimit = isRateLimitError(error);

      if (isRateLimit && currentKey) {
        console.warn(`Gemini operation failed with rate limit for model ${modelId}; retrying with another configured credential...`);
        apiKeyManager.markKeyFailed(currentKey, getRateLimitFailureKind(error));
        if (attempts < maxRetries && attemptBudget.remaining > 0) {
          await delay(getBackoffDelayMs(attempts), undefined, { signal });
        }
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Max retries exceeded for Gemini operation with model ${modelId}`);
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
