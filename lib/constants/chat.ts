export const CHAT_HISTORY = {
  MAX_MESSAGES: 20,
  MAX_CONTEXT_MESSAGES: 6,
  SUMMARY_THRESHOLD: 10,
  TOKEN_ESTIMATE_PER_MESSAGE: 100,
  MAX_TOKENS_ESTIMATE: 2000,
  MAX_CONTEXT_CHARS_PER_MESSAGE: 700,
  MAX_CONTEXT_SUMMARY_CHARS: 1200,
} as const;

export const SUGGESTED_QUESTIONS = [
  "Where is the Registrar's Office?",
  "How do I get to CET?",
  "Where is the Administration Building?",
  "Find the nearest Food Stall",
  "Where can I find a comfort room?",
  "Where is the Main Library?",
  "How do I get to the Computer Science Department?",
  "Where is the University Hospital?",
  "Where is the USSO?",
  "Find the Upper Oval",
  "Where is CET?",
  "How do I get to the Ecopark?",
  "Where is the Guard House?",
  "Where is the Guest House?",
  "Find the nearest print shop",
  "Boarding houses under ₱3,000?",
  "Ladies-only boarding houses?",
  "Rooms with aircon near campus?",
] as const;

export type ChatHistoryConfig = typeof CHAT_HISTORY;
