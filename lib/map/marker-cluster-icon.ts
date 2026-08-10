export type MarkerClusterIconSpec = {
  readonly html: string;
  readonly label: string;
  readonly size: number;
};

export function getMarkerClusterIconSpec(count: number): MarkerClusterIconSpec {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const label = `${safeCount} nearby map items`;
  const size = safeCount >= 100 ? 52 : safeCount >= 10 ? 48 : 44;

  return {
    html: `<span class="vsu-marker-cluster" role="img" aria-label="${label}">${safeCount}</span>`,
    label,
    size,
  };
}

export function isMarkerClusterActivationKey(key: string | undefined): boolean {
  return key === "Enter" || key === " " || key === "Spacebar";
}
