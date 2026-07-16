export function shouldClearRouteForSelectedItem({
  selectedItemId,
  routeDestinationId,
  hasNavigationState,
}: {
  selectedItemId: string | null;
  routeDestinationId: string | null;
  hasNavigationState: boolean;
}) {
  if (!hasNavigationState || !selectedItemId) {
    return false;
  }

  return selectedItemId !== routeDestinationId;
}

export function shouldClearRouteForMapSearch({
  searchQuery,
  selectedItemName,
  hasNavigationState,
}: {
  searchQuery: string;
  selectedItemName: string | null;
  hasNavigationState: boolean;
}) {
  if (!hasNavigationState) {
    return false;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return false;
  }

  if (!selectedItemName) {
    return true;
  }

  return normalizedQuery !== selectedItemName.trim().toLowerCase();
}
