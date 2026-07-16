export type MapViewState = {
  center: {
    lat: number;
    lng: number;
  };
  zoom: number;
};

export function getViewAfterDeselect(
  currentView: MapViewState,
  previousView: MapViewState | null
): MapViewState {
  if (previousView) {
    return previousView;
  }

  return {
    center: currentView.center,
    zoom: Math.max(currentView.zoom - 1, 0),
  };
}
