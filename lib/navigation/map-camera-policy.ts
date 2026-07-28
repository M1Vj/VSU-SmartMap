type CameraOwner = "selection" | "route";

export function doesNavigationOwnViewport({
  hasDestination,
  manualStartPending,
  pendingNavigation,
}: {
  hasDestination: boolean;
  manualStartPending: boolean;
  pendingNavigation: boolean;
}) {
  return hasDestination || manualStartPending || pendingNavigation;
}

export function getMapCameraPolicy({
  owner,
  navigationOwnsViewport,
  reducedMotion,
}: {
  owner: CameraOwner;
  navigationOwnsViewport: boolean;
  reducedMotion: boolean;
}) {
  const shouldMove = owner === "route" || !navigationOwnsViewport;
  return { shouldMove, animate: shouldMove && !reducedMotion };
}
