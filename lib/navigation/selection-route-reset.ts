export function shouldRestoreCommittedRouteForSelectedItem({
  selectedItemId,
  routeDestinationId,
  committedRouteDestinationId,
  pendingRequestId,
}: {
  selectedItemId: string | null;
  routeDestinationId: string | null;
  committedRouteDestinationId: string | null;
  pendingRequestId: number | null;
}) {
  return Boolean(
    pendingRequestId !== null &&
      selectedItemId &&
      committedRouteDestinationId &&
      selectedItemId === committedRouteDestinationId &&
      routeDestinationId !== committedRouteDestinationId,
  );
}
