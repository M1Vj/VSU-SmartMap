export interface MeasurableCard {
  getBoundingClientRect: () => { height: number };
}

export interface CardResizeObserver {
  observe: (card: MeasurableCard) => void;
  disconnect: () => void;
}

export type CardResizeObserverFactory = (onResize: () => void) => CardResizeObserver;

export function observeMapCardHeight(
  card: MeasurableCard,
  onHeightChange: (height: number) => void,
  createObserver?: CardResizeObserverFactory,
): () => void {
  const reportHeight = () => onHeightChange(card.getBoundingClientRect().height);
  reportHeight();
  if (!createObserver) return () => onHeightChange(0);

  const observer = createObserver(reportHeight);
  observer.observe(card);
  return () => {
    observer.disconnect();
    onHeightChange(0);
  };
}
