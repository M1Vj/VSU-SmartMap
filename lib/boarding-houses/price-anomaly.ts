const MIN_PEERS = 3;
const SUSPICIOUS_RATIO = 0.5;

/**
 * Flags a listing priced far below the local market — the classic rental-scam
 * lure. Compares the listing's lowest price against the median of its peers'
 * lowest prices; requires at least MIN_PEERS other priced listings so a tiny
 * dataset can't produce noise flags.
 */
export function isSuspiciouslyCheap(
  priceMin: number | null,
  peerPriceMins: ReadonlyArray<number | null>,
): boolean {
  if (priceMin === null || priceMin <= 0) return false;

  const peers = peerPriceMins.filter(
    (value): value is number => value !== null && value > 0 && value !== priceMin,
  );
  if (peers.length < MIN_PEERS) return false;

  const sorted = [...peers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  return priceMin < median * SUSPICIOUS_RATIO;
}
