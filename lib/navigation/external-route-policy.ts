export function canUseStraightRouteFallback({
  startInsideRoutingBoundary,
  endInsideRoutingBoundary,
}: {
  startInsideRoutingBoundary: boolean;
  endInsideRoutingBoundary: boolean;
}): boolean {
  return startInsideRoutingBoundary && endInsideRoutingBoundary;
}
