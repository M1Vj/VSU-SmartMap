"use client";

import { useMemo } from "react";
import { ExternalLink, MapPin } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  androidLocationSettingsIntent,
  detectPlatform,
  type DevicePlatform,
} from "@/lib/device/platform";

export type LocationHelpReason = "searching" | "unavailable" | "denied";

interface LocationHelpDialogProps {
  open: boolean;
  reason: LocationHelpReason;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
}

type HelpContent = {
  title: string;
  description: string;
  steps: string[];
  showAndroidSettingsButton: boolean;
};

function buildContent(
  platform: DevicePlatform,
  reason: LocationHelpReason
): HelpContent {
  if (reason === "denied") {
    if (platform === "ios") {
      return {
        title: "Turn on location for Safari",
        description:
          "Safari is blocking location for this site. Two quick checks usually fix it:",
        steps: [
          "Settings → Privacy & Security → Location Services → make sure it is On.",
          "In that list, tap Safari Websites → choose While Using the App, then turn on Precise Location.",
          "Come back here and tap My Location again.",
        ],
        showAndroidSettingsButton: false,
      };
    }
    if (platform === "android") {
      return {
        title: "Allow location for this site",
        description: "Chrome is blocking location for this page.",
        steps: [
          "Tap the lock or tune icon on the left of the address bar.",
          "Open Permissions → Location → set it to Allow.",
          "Reload the page and tap My Location again.",
        ],
        showAndroidSettingsButton: false,
      };
    }
    return {
      title: "Allow location for this site",
      description: "Your browser is blocking location for this page.",
      steps: [
        "Open the site permissions (the lock icon near the address bar).",
        "Set Location to Allow.",
        "Reload and tap My Location again.",
      ],
      showAndroidSettingsButton: false,
    };
  }

  // reason: "searching" | "unavailable" — device can't produce a fix.
  if (platform === "android") {
    return {
      title:
        reason === "searching"
          ? "Still finding your location…"
          : "Your phone couldn't find you",
      description:
        "Android needs its location service on to place you on the map. This is the same setting Google Maps uses.",
      steps: [
        "Open your phone Settings → Location and turn it On.",
        "Tap Location services → Google Location Accuracy (or “Improve Location Accuracy”) and turn it On.",
        "Return here and tap My Location again — outdoors gets a fix fastest.",
      ],
      showAndroidSettingsButton: true,
    };
  }
  if (platform === "ios") {
    return {
      title:
        reason === "searching"
          ? "Still finding your location…"
          : "Your iPhone couldn't find you",
      description:
        "iPhone needs Location Services on for Safari to place you on the map.",
      steps: [
        "Settings → Privacy & Security → Location Services → make sure it is On.",
        "Tap Safari Websites → While Using the App, and turn on Precise Location.",
        "Return here and tap My Location again — outdoors gets a fix fastest.",
      ],
      showAndroidSettingsButton: false,
    };
  }
  return {
    title:
      reason === "searching"
        ? "Still finding your location…"
        : "Couldn't find your location",
    description: "Your device could not produce a location fix.",
    steps: [
      "Make sure your device's location service (GPS) is turned on.",
      "Allow location for this site in your browser.",
      "Try again — outdoors with a clear view of the sky works best.",
    ],
    showAndroidSettingsButton: false,
  };
}

export function LocationHelpDialog({
  open,
  reason,
  onOpenChange,
  onRetry,
}: LocationHelpDialogProps) {
  const platform = useMemo(() => detectPlatform(), []);
  const content = useMemo(() => buildContent(platform, reason), [platform, reason]);

  const openAndroidSettings = () => {
    const intent = androidLocationSettingsIntent();
    if (intent) {
      window.location.href = intent;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-500" aria-hidden />
            {content.title}
          </DialogTitle>
          <DialogDescription>{content.description}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm">
          {content.steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-semibold text-blue-600"
                aria-hidden
              >
                {index + 1}
              </span>
              <span className="pt-0.5 text-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {content.showAndroidSettingsButton && (
            <Button
              variant="default"
              className="w-full"
              onClick={openAndroidSettings}
            >
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
              Open location settings
            </Button>
          )}
          <Button
            variant={content.showAndroidSettingsButton ? "outline" : "default"}
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              onRetry();
            }}
          >
            Try again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
