export const TBA_SEARCH_DIALOG_DELAY_MS = 500;

export function isTbaSearchQuery(query: string) {
  return query.trim().toLowerCase() === "tba";
}

export function getTbaSearchDialogDelay(query: string) {
  return isTbaSearchQuery(query) ? TBA_SEARCH_DIALOG_DELAY_MS : null;
}
