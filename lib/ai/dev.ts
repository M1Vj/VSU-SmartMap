import { genkit } from 'genkit';
import { googleAI, gemini } from '@genkit-ai/googleai';

const devModelId =
  process.env.GEMINI_MODEL_IDS?.split(',')[0]?.trim() ||
  process.env.GEMINI_MODEL_ID ||
  'gemini-3.5-flash';

const ai = genkit({
  plugins: [googleAI()],
  model: gemini(devModelId),
});

console.log('Genkit dev server configured. Run `npx genkit start` to launch UI.');

export default ai;
