"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// Define props for the wrapper component
type MapWrapperProps = {
  children?: React.ReactNode;
  className?: string;
};

const MapWrapper = dynamic(() => import("./map-wrapper").then((m) => m.MapWrapper), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-muted animate-pulse rounded-lg" aria-label="Loading map" />
  ),
}) as ComponentType<MapWrapperProps>;

type MapContainerProps = {
  children?: React.ReactNode;
  className?: string;
};

export function MapContainerClient({ children, className }: MapContainerProps) {
  return <MapWrapper className={className}>{children}</MapWrapper>;
}
