export type MapMarkerFocusTarget = Pick<HTMLElement, "dataset" | "isConnected" | "focus">;

/**
 * Focuses a marker only when the marker for the selected item is still mounted.
 * The DOM lookup happens in the map layer; keeping the selection check here
 * makes Escape restoration deterministic and easy to exercise without a
 * browser runtime.
 */
export function focusConnectedMarker(
  targets: Iterable<MapMarkerFocusTarget>,
  selectedId: string,
): boolean {
  for (const target of targets) {
    if (!target.isConnected || target.dataset.mapItemId !== selectedId) continue;
    target.focus();
    return true;
  }

  return false;
}
