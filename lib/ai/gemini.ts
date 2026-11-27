import { GoogleGenAI } from '@google/genai';
import { apiKeyManager } from './api-key-manager';
import { getProviderErrorStatus } from './chat-fallback';
import { getChatModelIds } from './model-policy';

export { DEFAULT_CHAT_MODEL_IDS, getChatModelIds } from './model-policy';

export const CHAT_MODEL_IDS = getChatModelIds();
export const CHAT_MODEL_ID = CHAT_MODEL_IDS[0];

const CHAT_ATTEMPT_BUDGET = 6;

class ChatAttemptBudgetError extends Error {
  constructor() {
    super('Max retries exceeded for Gemini operation');
    this.name = 'ChatAttemptBudgetError';
  }
}

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
  const status = getProviderErrorStatus(error);
  // A quota error does not establish capacity on another model or credential.
  return status === 404 || status === 503;
}

export async function runWithKeyRotation<T>(
  operation: (sdk: GoogleGenAI, modelId: string) => Promise<T>,
  options: { signal?: AbortSignal; onSuccess?: (metadata: GenerationRunMetadata) => void } = {},
): Promise<T> {
  let lastError: unknown;
  let remainingAttempts = CHAT_ATTEMPT_BUDGET;

  for (const modelId of CHAT_MODEL_IDS) {
    options.signal?.throwIfAborted();
    if (remainingAttempts === 0) throw new ChatAttemptBudgetError();

    const sdk = new GoogleGenAI({
      apiKey: apiKeyManager.getNextKey(),
      enterprise: false,
      apiVersion: 'v1beta',
      httpOptions: {
        // Preserve the Developer API destination for the selected key.
        baseUrl: 'https://generativelanguage.googleapis.com/',
        retryOptions: { attempts: 1 },
      },
    });
    remainingAttempts--;
    try {
      const result = await operation(sdk, modelId);
      options.signal?.throwIfAborted();
      options.onSuccess?.(createGenerationRunMetadata(modelId, remainingAttempts));
      return result;
    } catch (error: unknown) {
      options.signal?.throwIfAborted();
      lastError = error;

      if (
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
