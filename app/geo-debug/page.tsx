"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ProbeResult = {
  label: string;
  status: "pending" | "success" | "error";
  detail: string;
};

function formatPosition(position: GeolocationPosition) {
  const { latitude, longitude, accuracy } = position.coords;
  return `lat ${latitude.toFixed(6)}, lng ${longitude.toFixed(6)}, accuracy ${Math.round(accuracy)}m`;
}

function formatError(error: GeolocationPositionError) {
  const names: Record<number, string> = {
    1: "PERMISSION_DENIED",
    2: "POSITION_UNAVAILABLE",
    3: "TIMEOUT",
  };
  return `code ${error.code} (${names[error.code] ?? "UNKNOWN"}) — raw message: "${error.message}"`;
}

export default function GeoDebugPage() {
  const [environment, setEnvironment] = useState<Record<string, string>>({});
  const [permissionState, setPermissionState] = useState("checking…");
  const [probes, setProbes] = useState<ProbeResult[]>([]);

  useEffect(() => {
    setEnvironment({
      userAgent: navigator.userAgent,
      secureContext: String(window.isSecureContext),
      geolocationInNavigator: String("geolocation" in navigator),
      standaloneDisplayMode: String(
        window.matchMedia("(display-mode: standalone)").matches ||
          ("standalone" in navigator &&
            (navigator as unknown as { standalone?: boolean }).standalone === true)
      ),
      serviceWorkerController: String(Boolean(navigator.serviceWorker?.controller)),
      onLine: String(navigator.onLine),
    });

    if (!("permissions" in navigator)) {
      setPermissionState("Permissions API unavailable");
      return;
    }

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        setPermissionState(status.state);
        status.onchange = () => setPermissionState(status.state);
      })
      .catch((error) => setPermissionState(`query failed: ${String(error)}`));
  }, []);

  const runProbe = useCallback((label: string, options: PositionOptions) => {
    const startedAt = Date.now();
    setProbes((prev) => [
      ...prev.filter((probe) => probe.label !== label),
      { label, status: "pending", detail: "waiting for response…" },
    ]);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setProbes((prev) =>
          prev.map((probe) =>
            probe.label === label
              ? {
                  label,
                  status: "success",
                  detail: `${formatPosition(position)} after ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
                }
              : probe
          )
        );
      },
      (error) => {
        setProbes((prev) =>
          prev.map((probe) =>
            probe.label === label
              ? {
                  label,
                  status: "error",
                  detail: `${formatError(error)} after ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
                }
              : probe
          )
        );
      },
      options
    );
  }, []);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">Location Diagnostics</h1>
        <p className="text-sm text-muted-foreground">
          Run both tests outdoors if possible, then screenshot this whole page and
          send it to the developer.
        </p>
      </div>

      <section className="space-y-1 rounded-lg border p-3 text-sm">
        <h2 className="font-medium">Environment</h2>
        {Object.entries(environment).map(([key, value]) => (
          <p key={key} className="break-all">
            <span className="text-muted-foreground">{key}:</span> {value}
          </p>
        ))}
        <p>
          <span className="text-muted-foreground">permissionState (Permissions API):</span>{" "}
          <span className="font-semibold">{permissionState}</span>
        </p>
      </section>

      <section className="space-y-3 rounded-lg border p-3">
        <h2 className="text-sm font-medium">Probes</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              runProbe("network-location (low accuracy, 15s)", {
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: 0,
              })
            }
          >
            Test network location
          </Button>
          <Button
            size="sm"
            onClick={() =>
              runProbe("gps (high accuracy, 60s)", {
                enableHighAccuracy: true,
                timeout: 60000,
                maximumAge: 0,
              })
            }
          >
            Test GPS (wait up to 60s)
          </Button>
        </div>

        <ul className="space-y-2 text-sm">
          {probes.length === 0 && (
            <li className="text-muted-foreground">No probes run yet.</li>
          )}
          {probes.map((probe) => (
            <li key={probe.label} className="rounded border p-2">
              <p className="font-medium">{probe.label}</p>
              <p
                className={
                  probe.status === "success"
                    ? "text-green-600"
                    : probe.status === "error"
                      ? "text-red-600"
                      : "text-muted-foreground"
                }
              >
                {probe.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
