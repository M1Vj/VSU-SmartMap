"use client";

import { AppProgressBar } from "next-nprogress-bar";

export function NavigationProgress() {
  return (
    <>
      <AppProgressBar
        height="4px"
        color="hsl(var(--primary))"
        options={{ showSpinner: false }}
        shallowRouting
      />
      <style jsx global>{`
        #nprogress .bar {
          z-index: 9999 !important;
          background: hsl(var(--primary)) !important;
        }
        #nprogress .peg {
          box-shadow: 0 0 10px hsl(var(--primary)), 0 0 5px hsl(var(--primary)) !important;
        }
      `}</style>
    </>
  );
}
