import test from "node:test";
import assert from "node:assert/strict";

import { androidLocationSettingsIntent, detectPlatform } from "./platform.ts";

function withNavigator(userAgent: string, fn: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent },
    configurable: true,
  });
  try {
    fn();
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "navigator", previous);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  }
}

test("detectPlatform identifies iOS Safari", () => {
  withNavigator(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    () => assert.equal(detectPlatform(), "ios"),
  );
});

test("detectPlatform identifies Android Chrome", () => {
  withNavigator(
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
    () => assert.equal(detectPlatform(), "android"),
  );
});

test("detectPlatform falls back to other for desktop", () => {
  withNavigator(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    () => assert.equal(detectPlatform(), "other"),
  );
});

test("androidLocationSettingsIntent embeds a fallback url so a failed intent is benign", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: { location: { href: "https://vsumap.vercel.app/?category=academic" } },
    configurable: true,
  });
  try {
    const intent = androidLocationSettingsIntent();
    assert.ok(intent, "expected an intent url");
    assert.match(intent!, /^intent:\/\//);
    assert.match(intent!, /action=android\.settings\.LOCATION_SOURCE_SETTINGS/);
    assert.match(intent!, /S\.browser_fallback_url=https%3A%2F%2Fvsumap\.vercel\.app/);
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "window", previous);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
});
