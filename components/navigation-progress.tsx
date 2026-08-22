"use client";

import { AppProgressBar, startProgress } from "next-nprogress-bar";

/**
 * Starts the shared top loading bar for programmatic navigations
 * (button-driven router.push calls never hit the anchor-click path).
 */
export function startNavigationProgress() {
  startProgress();
}

/**
 * next-nprogress-bar 2.4.7 ships a default stylesheet that targets the old
 * `#nprogress` id while nprogress-v2 renders `.nprogress` class elements, so
 * the bar mounts with zero height and stays invisible. disableStyle drops the
 * dead rules; the block below styles the real structure as one thin,
 * YouTube-style line under the app header.
 */
export function NavigationProgress() {
  return (
    <>
      <AppProgressBar
        height="3px"
        color="hsl(var(--primary))"
        options={{ showSpinner: false }}
        shallowRouting
        disableStyle
      />
      <style jsx global>{`
        .nprogress {
          pointer-events: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          z-index: 9999;
          overflow: hidden;
        }
        .nprogress .bar {
          height: 100%;
          width: 100%;
          background: hsl(var(--primary));
        }
        .nprogress .peg {
          display: none;
        }
      `}</style>
    </>
  );
}
