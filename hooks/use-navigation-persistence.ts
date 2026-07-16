import { useState, useEffect, useCallback } from 'react';
import type { LatLng } from 'leaflet';

interface NavigationState {
  navStart: LatLng | null;
  navEnd: LatLng | null;
  routeStartTime: number | null; // Timestamp when the route was set
}

const LOCAL_STORAGE_KEY = 'vsu-smartmap-navigation';
const TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const EMPTY_NAVIGATION_STATE: NavigationState = { navStart: null, navEnd: null, routeStartTime: null };

function readStoredNavigationState(): NavigationState {
  if (typeof window === 'undefined') return EMPTY_NAVIGATION_STATE;

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return EMPTY_NAVIGATION_STATE;

    const parsed: NavigationState = JSON.parse(stored);
    if (parsed.routeStartTime && (Date.now() - parsed.routeStartTime) < TIMEOUT_MS) {
      return parsed;
    }

    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to parse navigation state from localStorage", error);
  }

  return EMPTY_NAVIGATION_STATE;
}

export function useNavigationPersistence() {
  const [navigationState, setNavigationState] = useState<NavigationState>(readStoredNavigationState);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(navigationState));
    } catch (error) {
      console.error("Failed to save navigation state to localStorage", error);
    }
  }, [navigationState]);

  // Functions to update specific parts of the navigation state
  const setNavStart = useCallback((point: LatLng | null) => {
    setNavigationState(prev => ({
      ...prev,
      navStart: point,
      routeStartTime: point || prev.navEnd ? (prev.routeStartTime || Date.now()) : null,
    }));
  }, []);

  const setNavEnd = useCallback((point: LatLng | null) => {
    setNavigationState(prev => ({
      ...prev,
      navEnd: point,
      routeStartTime: point || prev.navStart ? (prev.routeStartTime || Date.now()) : null,
    }));
  }, []);

  const clearNavigation = useCallback(() => {
    setNavigationState({ navStart: null, navEnd: null, routeStartTime: null });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  return {
    navStart: navigationState.navStart,
    setNavStart,
    navEnd: navigationState.navEnd,
    setNavEnd,
    routeStartTime: navigationState.routeStartTime,
    clearNavigation,
  };
}
