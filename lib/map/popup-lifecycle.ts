import {
  shouldDeselectAfterPopupClose,
  type MarkerPopupCloseReason,
} from "./popup-close";

export type MarkerPopupModality = "mouse" | "touch" | "pen" | "keyboard";

export type MarkerPopupCloseEffects = {
  closePopup: () => void;
  onDeselect?: () => void;
  restoreMarkerFocus?: () => void;
};

export type MarkerPopupNavigateEffects = {
  closePopup: () => void;
};

export type MarkerPopupLifecycleController = {
  selectionChanged: (isSelected: boolean) => void;
  opened: (modality: MarkerPopupModality, focusFirstControl: () => void) => void;
  close: (reason: MarkerPopupCloseReason, effects: MarkerPopupCloseEffects) => boolean;
  navigate: (
    action: () => number | null | void,
    effects: MarkerPopupNavigateEffects,
  ) => number | null;
};

type OpenToken = {
  modality: MarkerPopupModality;
  closed: boolean;
  navigationAttemptPending: boolean;
};

/**
 * Keeps popup side effects ahead of React's next render commit.
 *
 * Leaflet can deliver a close, action, and compatibility callback in one
 * browser task. The token is therefore deliberately mutable and remains
 * closed until selectionChanged(false) retires it.
 */
export function createMarkerPopupLifecycleController(): MarkerPopupLifecycleController {
  let selected = false;
  let openToken: OpenToken | null = null;

  const selectionChanged = (isSelected: boolean) => {
    selected = isSelected;
    if (!isSelected) {
      openToken = null;
    } else if (openToken?.closed) {
      openToken = null;
    }
  };

  const opened = (
    modality: MarkerPopupModality,
    focusFirstControl: () => void,
  ) => {
    if (openToken?.closed) openToken = null;
    if (openToken) return;

    selected = true;
    const token: OpenToken = {
      modality,
      closed: false,
      navigationAttemptPending: false,
    };
    openToken = token;

    if (modality === "keyboard") {
      queueMicrotask(() => {
        if (openToken === token && !token.closed) {
          focusFirstControl();
        }
      });
    }
  };

  const close = (
    reason: MarkerPopupCloseReason,
    effects: MarkerPopupCloseEffects,
  ) => {
    const token = openToken;
    if (!token || token.closed) return false;

    token.closed = true;
    token.navigationAttemptPending = false;
    effects.closePopup();

    if (shouldDeselectAfterPopupClose(selected, reason)) {
      effects.onDeselect?.();
      if (token.modality === "keyboard") effects.restoreMarkerFocus?.();
    }

    return true;
  };

  const navigate = (
    action: () => number | null | void,
    effects: MarkerPopupNavigateEffects,
  ) => {
    const token = openToken;
    if (!token || token.closed || token.navigationAttemptPending) return null;

    token.navigationAttemptPending = true;
    let result: number | null | void;
    try {
      result = action();
    } catch (error) {
      token.navigationAttemptPending = false;
      throw error;
    }

    if (typeof result !== "number") {
      queueMicrotask(() => {
        if (openToken === token && !token.closed) {
          token.navigationAttemptPending = false;
        }
      });
      return null;
    }

    token.navigationAttemptPending = false;
    token.closed = true;
    effects.closePopup();
    return result;
  };

  return { selectionChanged, opened, close, navigate };
}

export function shouldHandleMapSelectionEscape({
  key,
  defaultPrevented,
}: {
  key: string;
  defaultPrevented: boolean;
}) {
  return key === "Escape" && !defaultPrevented;
}
