export type MutableFlag = { current: boolean };

export function runMapPopupActionOnce(
  pending: MutableFlag,
  action: () => void,
) {
  if (pending.current) return false;
  pending.current = true;
  try {
    action();
    return true;
  } finally {
    queueMicrotask(() => {
      pending.current = false;
    });
  }
}
