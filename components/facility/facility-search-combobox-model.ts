export type FacilityComboboxRenderState = {
  showRecents: boolean;
  renderFacilityOptions: boolean;
  renderedCount: number;
  showStatus: boolean;
  shouldRenderListbox: boolean;
};

type FacilityComboboxRenderInput = {
  query: string;
  optionsQuery: string;
  optionCount: number;
  recentCount: number;
  focused: boolean;
  open: boolean;
  loading: boolean;
  unavailable: boolean;
  suppressResults: boolean;
};

export function getFacilityComboboxRenderState({
  query,
  optionsQuery,
  optionCount,
  recentCount,
  focused,
  open,
  loading,
  unavailable,
  suppressResults,
}: FacilityComboboxRenderInput): FacilityComboboxRenderState {
  if (suppressResults) {
    return {
      showRecents: false,
      renderFacilityOptions: false,
      renderedCount: 0,
      showStatus: false,
      shouldRenderListbox: false,
    };
  }

  const normalizedQuery = query.trim().toLowerCase();
  const optionsSettled =
    normalizedQuery === optionsQuery.trim().toLowerCase();
  const showRecents =
    focused && normalizedQuery.length === 0 && recentCount > 0;
  const renderFacilityOptions =
    normalizedQuery.length > 0 && optionsSettled;
  const renderedCount = showRecents
    ? recentCount
    : renderFacilityOptions
      ? optionCount
      : 0;
  const showStatus =
    normalizedQuery.length > 0 &&
    (loading ||
      (optionsSettled && (unavailable || (!loading && optionCount === 0))));
  const shouldRenderListbox =
    focused &&
    open &&
    (showRecents || renderedCount > 0 || showStatus);

  return {
    showRecents,
    renderFacilityOptions,
    renderedCount,
    showStatus,
    shouldRenderListbox,
  };
}

export type FacilityComboboxKeyAction = {
  preventDefault: boolean;
  open: boolean | null;
  highlightedIndex: number;
  selectIndex: number | null;
};

export function getFacilityComboboxKeyAction(
  key: string,
  highlightedIndex: number,
  renderedCount: number,
): FacilityComboboxKeyAction {
  if (key === "ArrowDown" && renderedCount > 0) {
    return {
      preventDefault: true,
      open: true,
      highlightedIndex: (highlightedIndex + 1) % renderedCount,
      selectIndex: null,
    };
  }

  if (key === "ArrowUp" && renderedCount > 0) {
    return {
      preventDefault: true,
      open: true,
      highlightedIndex:
        highlightedIndex <= 0 ? renderedCount - 1 : highlightedIndex - 1,
      selectIndex: null,
    };
  }

  if (key === "Enter" && renderedCount > 0) {
    return {
      preventDefault: true,
      open: null,
      highlightedIndex,
      selectIndex:
        highlightedIndex >= 0 && highlightedIndex < renderedCount
          ? highlightedIndex
          : 0,
    };
  }

  if (key === "Escape") {
    return {
      preventDefault: false,
      open: false,
      highlightedIndex: -1,
      selectIndex: null,
    };
  }

  return {
    preventDefault: false,
    open: null,
    highlightedIndex,
    selectIndex: null,
  };
}
