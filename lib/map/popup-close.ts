export type MarkerPopupCloseReason = "dismiss" | "action" | "selection-transfer";

export function shouldDeselectAfterPopupClose(
  isSelected: boolean,
  reason: MarkerPopupCloseReason,
) {
  return isSelected && reason === "dismiss";
}
