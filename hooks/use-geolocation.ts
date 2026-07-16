"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

interface DeviceOrientationEventWithCompass extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

export interface GeolocationState {
  position: GeolocationPosition | null;
  accuracy: number | null;
  heading: number | null;
  error: GeolocationPositionError | null;
  isTracking: boolean;
  isSupported: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 30000,
  maximumAge: 10000,
};

const INSECURE_CONTEXT_MESSAGE =
  "Location requires a secure (HTTPS) connection. If you're testing on mobile, open the deployed site (HTTPS) or use an HTTPS tunnel.";

// How many extra GPS windows to try after the first high-accuracy timeout
// before giving up. Each window is highWatchOptions.timeout long.
const MAX_HIGH_ACCURACY_RETRIES = 1;

function makeGeolocationError(code: number, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

function isSecureOriginErrorMessage(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("only secure origins") ||
    m.includes("secure origin") ||
    m.includes("insecure") ||
    m.includes("https")
  );
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    accuracy: null,
    heading: null,
    error: null,
    isTracking: false,
    isSupported: typeof navigator !== "undefined" && "geolocation" in navigator,
  });

  const watchIdRef = useRef<number | null>(null);
  const watchModeRef = useRef<"low" | "high">("low");
  const hasUpgradedRef = useRef(false);
  const hasFixRef = useRef(false);
  const escalatedRef = useRef(false);
  const retryCountRef = useRef(0);
  const lastErrorRef = useRef<{ code: number; message: string } | null>(null);
  const isTrackingRef = useRef(false);
  const handleErrorRef = useRef<(error: GeolocationPositionError) => void>(() => {});
  const mergedOptions = useMemo((): PositionOptions => ({
    enableHighAccuracy: options.enableHighAccuracy ?? defaultOptions.enableHighAccuracy,
    timeout: options.timeout ?? defaultOptions.timeout,
    maximumAge: options.maximumAge ?? defaultOptions.maximumAge,
  }), [options.enableHighAccuracy, options.timeout, options.maximumAge]);

  const mergedTimeout = mergedOptions.timeout ?? defaultOptions.timeout ?? 45000;
  const mergedMaximumAge = mergedOptions.maximumAge ?? defaultOptions.maximumAge ?? 60000;

  const lowAccuracyOptions = useMemo<PositionOptions>(() => ({
    enableHighAccuracy: false,
    timeout: Math.min(20000, mergedTimeout),
    maximumAge: Math.max(300000, mergedMaximumAge),
  }), [mergedTimeout, mergedMaximumAge]);

  // GPS-only acquisition (used when network location is unavailable, e.g.
  // Android "Google Location Accuracy" off). A cold GPS fix can take a while,
  // so give the watch a long leash instead of the shorter tracking timeout.
  const highWatchOptions = useMemo<PositionOptions>(() => ({
    enableHighAccuracy: true,
    timeout: Math.max(45000, mergedTimeout),
    maximumAge: mergedMaximumAge,
  }), [mergedTimeout, mergedMaximumAge]);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    hasFixRef.current = true;
    setState((prev) => ({
      ...prev,
      position,
      accuracy: position.coords.accuracy,
      error: null,
    }));
  }, []);

  useEffect(() => {
    isTrackingRef.current = state.isTracking;
  }, [state.isTracking]);

  const normalizeError = useCallback((error: GeolocationPositionError): GeolocationPositionError => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return makeGeolocationError(1, INSECURE_CONTEXT_MESSAGE);
    }

    const message = error.message ?? "";

    if (error.code === 1 && isSecureOriginErrorMessage(message)) {
      return makeGeolocationError(1, INSECURE_CONTEXT_MESSAGE);
    }

    if (error.code === 1) {
      return makeGeolocationError(
        1,
        "Location access is blocked for this site. iPhone Safari: tap “AA” in the address bar → Website Settings → Location → Allow. Android Chrome: tap the lock icon → Permissions → Location → Allow."
      );
    }

    if (error.code === 2) {
      return makeGeolocationError(
        2,
        "Your phone could not find a location. Turn on Location/GPS (Android: also enable “Google Location Accuracy”), then try again — ideally outdoors."
      );
    }

    if (error.code === 3) {
      return makeGeolocationError(
        3,
        "Timed out getting a fix. Turn on Location/GPS (Android: also enable “Google Location Accuracy”) and try again outdoors; the first fix can take up to a minute."
      );
    }

    return makeGeolocationError(error.code, message || "Location error occurred.");
  }, []);

  const handleErrorStable = useCallback((error: GeolocationPositionError) => {
    handleErrorRef.current(error);
  }, []);

  const beginWatch = useCallback((mode: "low" | "high") => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    watchModeRef.current = mode;
    const id = navigator.geolocation.watchPosition(
      handleSuccess,
      handleErrorStable,
      mode === "high" ? highWatchOptions : lowAccuracyOptions
    );

    if (!isTrackingRef.current) {
      navigator.geolocation.clearWatch(id);
    } else {
      watchIdRef.current = id;
    }
  }, [handleSuccess, handleErrorStable, highWatchOptions, lowAccuracyOptions]);

  const escalateToHighAccuracy = useCallback(() => {
    escalatedRef.current = true;
    hasUpgradedRef.current = true;
    beginWatch("high");
  }, [beginWatch]);

  const handleErrorInternal = useCallback((error: GeolocationPositionError) => {
    const normalized = normalizeError(error);
    const sameAsLast =
      lastErrorRef.current?.code === normalized.code &&
      lastErrorRef.current?.message === normalized.message;
    lastErrorRef.current = { code: normalized.code, message: normalized.message };

    if (normalized.code === 1) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      isTrackingRef.current = false;
      setState((prev) => ({ ...prev, isTracking: false, error: normalized }));
      return;
    }

    const isTimeout = normalized.code === 3;

    // Before the first fix, low-accuracy (network) location often fails on
    // phones — escalate once to high accuracy so the GPS chip gets a chance.
    const canEscalate =
      isTrackingRef.current &&
      !hasFixRef.current &&
      !escalatedRef.current &&
      watchModeRef.current === "low";

    if ((normalized.code === 2 || isTimeout) && canEscalate) {
      escalateToHighAccuracy();
      return;
    }

    if (
      isTimeout &&
      isTrackingRef.current &&
      watchModeRef.current === "high" &&
      !hasFixRef.current
    ) {
      if (retryCountRef.current < MAX_HIGH_ACCURACY_RETRIES) {
        retryCountRef.current += 1;
        // Keep the GPS chip trying rather than dropping back to network
        // location, which is exactly what is unavailable in this case.
        beginWatch("high");

        // Surface the timeout once so the UI can offer guidance while GPS
        // keeps searching in the background.
        if (!sameAsLast) {
          setState((prev) => ({ ...prev, error: normalized }));
        }
        return;
      }

      // GPS never produced a fix — stop searching and show the actionable
      // timeout so the spinner does not spin forever.
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      isTrackingRef.current = false;
      setState((prev) => ({ ...prev, isTracking: false, error: normalized }));
      return;
    }

    if (normalized.code === 2) {
      if (hasFixRef.current) {
        // Transient signal loss after a fix: keep the watch alive and surface
        // the error without dropping tracking.
        if (!sameAsLast) {
          setState((prev) => ({ ...prev, error: normalized }));
        }
        return;
      }

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      isTrackingRef.current = false;
      setState((prev) => ({ ...prev, isTracking: false, error: normalized }));
      return;
    }

    if (!sameAsLast) {
      setState((prev) => ({
        ...prev,
        error: normalized,
      }));
    }
  }, [beginWatch, escalateToHighAccuracy, normalizeError]);

  useEffect(() => {
    handleErrorRef.current = handleErrorInternal;
  }, [handleErrorInternal]);

  const handleOrientation = useCallback((event: DeviceOrientationEventWithCompass) => {
    if (event.alpha !== null) {
      const heading = event.webkitCompassHeading ?? (360 - event.alpha);
      setState((prev) => ({
        ...prev,
        heading,
      }));
    }
  }, []);

  const startTracking = useCallback(() => {
    // Sanity check: if we aren't tracking but have an active watch ID, clean it up first
    if (watchIdRef.current !== null && !isTrackingRef.current) {
      try {
        navigator.geolocation.clearWatch(watchIdRef.current);
      } catch (e) {
        console.error("Error clearing stale watch:", e);
      }
      watchIdRef.current = null;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    lastErrorRef.current = null;
    handleErrorRef.current = handleErrorInternal;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      const error = makeGeolocationError(1, INSECURE_CONTEXT_MESSAGE);
      isTrackingRef.current = false;
      setState((prev) => ({ ...prev, isTracking: false, error }));
      return;
    }

    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: makeGeolocationError(2, "Geolocation is not supported by your browser."),
      }));
      return;
    }

    hasUpgradedRef.current = false;
    hasFixRef.current = false;
    escalatedRef.current = false;
    retryCountRef.current = 0;
    watchModeRef.current = "low";

    isTrackingRef.current = true;
    setState((prev) => ({ ...prev, isTracking: true, error: null }));

    const fastOptions: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleSuccess(position);
        if (isTrackingRef.current) {
          beginWatch("low");
        }
      },
      (error) => {
        const normalized = normalizeError(error);
        if (normalized.code === 1) {
          // If permission is denied, fail immediately and do not start watching
          handleErrorInternal(error);
        } else if (isTrackingRef.current) {
          // Network location failed — common when "Google Location Accuracy"
          // is off. Go straight to the GPS chip instead of retrying the
          // network provider that just failed.
          escalateToHighAccuracy();
        }
      },
      fastOptions
    );

    if (typeof DeviceOrientationEvent !== "undefined") {
      const requestPermission = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
      if (typeof requestPermission === "function") {
        requestPermission()
          .then((response: string) => {
            if (response === "granted") {
              window.addEventListener("deviceorientation", handleOrientation, true);
            }
          })
          .catch((err) => {
            console.warn("DeviceOrientationEvent permission denied:", err);
          });
      } else {
        window.addEventListener("deviceorientation", handleOrientation, true);
      }
    }
  }, [state.isSupported, handleErrorInternal, handleSuccess, handleOrientation, beginWatch, escalateToHighAccuracy, normalizeError]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    window.removeEventListener("deviceorientation", handleOrientation, true);

    isTrackingRef.current = false;
    setState((prev) => ({
      ...prev,
      isTracking: false,
    }));
  }, [handleOrientation]);

  useEffect(() => {
    if (
      !state.isTracking ||
      !state.position ||
      hasUpgradedRef.current ||
      watchModeRef.current !== "low" ||
      !mergedOptions.enableHighAccuracy
    ) {
      return;
    }

    hasUpgradedRef.current = true;
    retryCountRef.current = 0;
    beginWatch("high");
  }, [state.isTracking, state.position, mergedOptions.enableHighAccuracy, beginWatch]);

  const flyToUser = useCallback(() => {
    if (!state.isTracking) {
      startTracking();
    }
    return state.position;
  }, [state.isTracking, state.position, startTracking]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [handleOrientation]);

  // Re-register watch when tab becomes visible (handles Safari freezing watchPosition on background/lock)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && state.isTracking) {
        stopTracking();
        startTracking();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state.isTracking, startTracking, stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    flyToUser,
  };
}
