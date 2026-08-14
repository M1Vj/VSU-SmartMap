import { useState, useEffect, useCallback } from 'react';
import type { LatLng } from 'leaflet';
import type { NavigationOrigin } from '@/lib/map/map-runtime';
import type { TransportMode } from '@/lib/types/graph';

export interface NavigationState {
  navStart: LatLng | null;
  navEnd: LatLng | null;
  destinationId: string | null;
  mode: TransportMode | null;
  origin: NavigationOrigin | null;
  routeStartTime: number | null; // Timestamp when the route was set
}

const LOCAL_STORAGE_KEY = 'vsu-smartmap-navigation';
const TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
export const EMPTY_NAVIGATION_STATE: NavigationState = {
  navStart: null,
  navEnd: null,
  destinationId: null,
  mode: null,
  origin: null,
  routeStartTime: null,
};

function isPoint(value: unknown): value is LatLng {
  if (!value || typeof value !== 'object') return false;
  const point = value as { lat?: unknown; lng?: unknown };
  return typeof point.lat === 'number' && Number.isFinite(point.lat) &&
    typeof point.lng === 'number' && Number.isFinite(point.lng);
}

function isMode(value: unknown): value is TransportMode {
  return value === 'walking' || value === 'driving';
}

function isOrigin(value: unknown): value is NavigationOrigin {
  return value === 'live' || value === 'manual';
}

export function parseStoredNavigationState(value: unknown, now = Date.now()): NavigationState {
  if (!value || typeof value !== 'object') return EMPTY_NAVIGATION_STATE;
  const parsed = value as Record<string, unknown>;
  const routeStartTime = parsed.routeStartTime;
  const destinationId = typeof parsed.destinationId === 'string' ? parsed.destinationId.trim() : '';
  if (
    !isPoint(parsed.navStart) ||
    !isPoint(parsed.navEnd) ||
    !destinationId ||
    !isMode(parsed.mode) ||
    !isOrigin(parsed.origin) ||
    typeof routeStartTime !== 'number' ||
    !Number.isFinite(routeStartTime) ||
    routeStartTime <= 0 ||
    now - routeStartTime >= TIMEOUT_MS
  ) {
    return EMPTY_NAVIGATION_STATE;
  }

  return {
    navStart: parsed.navStart,
    navEnd: parsed.navEnd,
    destinationId,
    mode: parsed.mode,
    origin: parsed.origin,
    routeStartTime,
  };
}

function readStoredNavigationState(): NavigationState {
  if (typeof window === 'undefined') return EMPTY_NAVIGATION_STATE;

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return EMPTY_NAVIGATION_STATE;

    const parsed = parseStoredNavigationState(JSON.parse(stored));
    if (parsed !== EMPTY_NAVIGATION_STATE) return parsed;
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to parse navigation state from localStorage", error);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }

  return EMPTY_NAVIGATION_STATE;
}

export function useNavigationPersistence() {
  const [navigationState, setNavigationState] = useState<NavigationState>(readStoredNavigationState);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if (
        navigationState.navStart === null &&
        navigationState.navEnd === null &&
        navigationState.destinationId === null &&
        navigationState.mode === null &&
        navigationState.origin === null &&
        navigationState.routeStartTime === null
      ) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return;
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(navigationState));
    } catch (error) {
      console.error("Failed to save navigation state to localStorage", error);
    }
  }, [navigationState]);

  // Functions to update specific parts of the navigation state
  const setNavStart = useCallback((point: LatLng | null) => {
    setNavigationState(prev => {
      const hasCompleteRoute = Boolean(point && prev.navEnd && prev.destinationId && prev.mode && prev.origin);
      return {
        ...prev,
        navStart: point,
        ...(hasCompleteRoute ? {} : { destinationId: null, mode: null, origin: null }),
        routeStartTime: hasCompleteRoute ? (prev.routeStartTime || Date.now()) : null,
      };
    });
  }, []);

  const setNavEnd = useCallback((point: LatLng | null) => {
    setNavigationState(prev => {
      const hasCompleteRoute = Boolean(point && prev.navStart && prev.destinationId && prev.mode && prev.origin);
      return {
        ...prev,
        navEnd: point,
        ...(hasCompleteRoute ? {} : { destinationId: null, mode: null, origin: null }),
        routeStartTime: hasCompleteRoute ? (prev.routeStartTime || Date.now()) : null,
      };
    });
  }, []);

  const setNavigationRoute = useCallback((route: {
    navStart: LatLng;
    navEnd: LatLng;
    destinationId: string;
    mode: TransportMode;
    origin: NavigationOrigin;
  }) => {
    setNavigationState({
      ...route,
      routeStartTime: Date.now(),
    });
  }, []);

  const clearNavigation = useCallback(() => {
    setNavigationState(EMPTY_NAVIGATION_STATE);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  return {
    navStart: navigationState.navStart,
    setNavStart,
    navEnd: navigationState.navEnd,
    setNavEnd,
    destinationId: navigationState.destinationId,
    mode: navigationState.mode,
    origin: navigationState.origin,
    setNavigationRoute,
    routeStartTime: navigationState.routeStartTime,
    clearNavigation,
  };
}
