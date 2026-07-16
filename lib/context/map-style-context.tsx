"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";

export type MapStyle = "vector" | "satellite";

interface MapStyleContextValue {
  mapStyle: MapStyle;
  setMapStyle: (style: MapStyle) => void;
}

const MapStyleContext = createContext<MapStyleContextValue | null>(null);

export function MapStyleProvider({ children }: { children: ReactNode }) {
  const [mapStyle, setMapStyleState] = useState<MapStyle>("satellite");

  // Load from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem("vsu-map-style") as MapStyle | null;
    if (stored && (stored === "vector" || stored === "satellite")) {
      setMapStyleState(stored);
    }
  }, []);

  const setMapStyle = useCallback((style: MapStyle) => {
    setMapStyleState(style);
    localStorage.setItem("vsu-map-style", style);
  }, []);

  const value = useMemo<MapStyleContextValue>(() => ({
    mapStyle,
    setMapStyle,
  }), [mapStyle, setMapStyle]);

  return <MapStyleContext.Provider value={value}>{children}</MapStyleContext.Provider>;
}

export function useMapStyle() {
  const context = useContext(MapStyleContext);
  if (!context) {
    throw new Error("useMapStyle must be used within MapStyleProvider");
  }
  return context;
}
