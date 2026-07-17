import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminSidebarSource = readFileSync(
  new URL("./admin/admin-sidebar.tsx", import.meta.url),
  "utf8",
);
const appHeaderSource = readFileSync(
  new URL("./app-header.tsx", import.meta.url),
  "utf8",
);
const chatAvatarSource = readFileSync(
  new URL("./chat/chat-avatar.tsx", import.meta.url),
  "utf8",
);

const versionedIconSource = 'src="/icons/icon-192x192.png?v=20260709"';

test("versioned local icons bypass the Next image optimizer", () => {
  for (const [component, source] of [
    ["admin sidebar", adminSidebarSource],
    ["app header", appHeaderSource],
    ["chat avatar", chatAvatarSource],
  ] as const) {
    const iconStart = source.indexOf(versionedIconSource);
    assert.notEqual(iconStart, -1, `${component} must use the versioned icon`);

    const imageMarkup = source.slice(iconStart, source.indexOf("/>", iconStart));
    assert.match(
      imageMarkup,
      /\bunoptimized\b/,
      `${component} must load the cache-busted local icon directly`,
    );
  }
});

test("admin sidebar brand remains compact if its icon cannot render", () => {
  assert.match(
    adminSidebarSource,
    /alt=""[\s\S]*?className="h-10 w-10 shrink-0 rounded-lg"/,
  );
  assert.match(adminSidebarSource, /<div className="min-w-0 space-y-0\.5">/);
});

test("admin sidebar dialog includes an accessible description", () => {
  assert.match(
    adminSidebarSource,
    /import \{ Sheet, SheetContent, SheetDescription, SheetTitle \}/,
  );
  assert.match(
    adminSidebarSource,
    /<SheetDescription className="sr-only">Navigate the SmartMap admin workspace\.<\/SheetDescription>/,
  );
});
