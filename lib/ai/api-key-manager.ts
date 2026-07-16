export class ApiKeyManager {
  private keys: string[];
  private failedUntil: Map<string, number> = new Map();
  private lastUsedAt: Map<string, number> = new Map();
  private readonly now: () => number;
  private readonly RPM_COOLDOWN_MS = 60 * 1000;

  constructor(keys: string[], options?: { now?: () => number }) {
    this.keys = keys.filter((key) => key.trim().length > 0);
    this.now = options?.now ?? Date.now;
    if (this.keys.length === 0) {
      console.warn('No Gemini API keys provided. Chat features will not work.');
    }
  }

  getNextKey(): string {
    if (this.keys.length === 0) {
      throw new Error('No API keys configured');
    }

    const readyKeys = this.keys.filter((key) => this.isKeyReady(key));

    if (readyKeys.length === 0) {
      throw new Error('All API keys are currently rate limited. Please try again later.');
    }

    const selected = readyKeys.reduce((oldestKey, key) => {
      const oldestUsedAt = this.lastUsedAt.get(oldestKey) ?? 0;
      const usedAt = this.lastUsedAt.get(key) ?? 0;
      return usedAt < oldestUsedAt ? key : oldestKey;
    }, readyKeys[0]);

    this.lastUsedAt.set(selected, this.now());
    return selected;
  }

  markKeyFailed(key: string, kind: 'rpm' | 'rpd' = 'rpm') {
    const cooldownUntil =
      kind === 'rpd'
        ? getNextPacificMidnight(this.now())
        : this.now() + this.RPM_COOLDOWN_MS;
    this.failedUntil.set(key, cooldownUntil);
  }

  private isKeyReady(key: string): boolean {
    const cooldownUntil = this.failedUntil.get(key);
    if (!cooldownUntil) return true;

    if (this.now() >= cooldownUntil) {
      this.failedUntil.delete(key);
      return true;
    }

    return false;
  }
}

function getPacificParts(timestamp: number): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function getPacificOffsetMinutes(date: Date): number {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = timeZoneName?.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) return -8 * 60;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  return hours * 60 + Math.sign(hours) * minutes;
}

function getNextPacificMidnight(timestamp: number): number {
  const pacificDate = getPacificParts(timestamp);
  const nextDayNoonUtc = new Date(Date.UTC(pacificDate.year, pacificDate.month - 1, pacificDate.day + 1, 12));
  const nextPacificDate = getPacificParts(nextDayNoonUtc.getTime());
  const midnightUtcGuess = Date.UTC(nextPacificDate.year, nextPacificDate.month - 1, nextPacificDate.day);
  const offset = getPacificOffsetMinutes(new Date(midnightUtcGuess));
  const firstPass = midnightUtcGuess - offset * 60 * 1000;
  const correctedOffset = getPacificOffsetMinutes(new Date(firstPass));

  return midnightUtcGuess - correctedOffset * 60 * 1000;
}

const keys = (process.env.GEMINI_API_KEYS || '').split(',').map((k) => k.trim());
export const apiKeyManager = new ApiKeyManager(keys);
