import { BlockedReason, FinishReason, type GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { IncompleteChatGenerationError } from './chat-fallback';
import { LocationResponseSchema } from './schemas/location';

const { $schema: _draftMarker, ...geminiResponseSchema } = z.toJSONSchema(
  LocationResponseSchema,
  {
    target: 'draft-7',
    override: ({ jsonSchema }) => {
      // Gemini's JSON-schema subset does not advertise string length limits.
      // The real application schema still enforces them on the returned JSON.
      delete jsonSchema.maxLength;
    },
  },
);

const blockedFinishReasons = new Set([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);

export async function generateLocation(
  sdk: GoogleGenAI,
  model: string,
  prompt: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const response = await sdk.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseJsonSchema: geminiResponseSchema,
      // A continuation would make another wire request outside the app's budget.
      automaticContinuation: false,
      abortSignal: signal,
    },
  });
  signal?.throwIfAborted();
  const promptBlock = response.promptFeedback?.blockReason;
  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason;
  if (
    (promptBlock && promptBlock !== BlockedReason.BLOCKED_REASON_UNSPECIFIED) ||
    (finishReason && blockedFinishReasons.has(finishReason))
  ) {
    throw new Error('Generation blocked.');
  }
  if (
    finishReason === FinishReason.MAX_TOKENS ||
    finishReason === FinishReason.CONTINUATION ||
    (!finishReason && candidate?.continuationToken)
  ) {
    throw new IncompleteChatGenerationError();
  }
  const text = response.text;
  if (!text?.trim()) throw new Error('AI failed to generate a response');
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('AI response validation failed: expected JSON');
  }
  const parsed = LocationResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error('AI response validation failed: invalid location data');
  return parsed.data;
}
