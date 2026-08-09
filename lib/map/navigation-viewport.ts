type NavigationControlsInput = {
  hasActiveRoute: boolean;
  isManualStartPending: boolean;
  isWaitingForLocation: boolean;
};

type NavigationControlsState = {
  primaryActionLabel: "Cancel Route" | "Clear Route";
  canReportRoute: boolean;
  statusText: string | null;
};

export function getNavigationControlsState({
  hasActiveRoute,
  isManualStartPending,
  isWaitingForLocation,
}: NavigationControlsInput): NavigationControlsState {
  if (hasActiveRoute) {
    return {
      primaryActionLabel: "Clear Route",
      canReportRoute: true,
      statusText: null,
    };
  }

  if (isManualStartPending) {
    return {
      primaryActionLabel: "Cancel Route",
      canReportRoute: false,
      statusText: "Tap the map to place your starting pin",
    };
  }

  if (isWaitingForLocation) {
    return {
      primaryActionLabel: "Cancel Route",
      canReportRoute: false,
      statusText: "Waiting for your location...",
    };
  }

  return {
    primaryActionLabel: "Cancel Route",
    canReportRoute: false,
    statusText: null,
  };
}
