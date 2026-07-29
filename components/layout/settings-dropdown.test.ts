import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./settings-dropdown.tsx", import.meta.url),
  "utf8",
);

test("mobile navigation tabs use an inline disclosure while desktop keeps its submenu", () => {
  assert.match(source, /MOBILE_SETTINGS_QUERY = "\(max-width: 767px\)"/);
  assert.match(
    source,
    /const \[mobileNavigationTabsOpen, setMobileNavigationTabsOpen\] = useState\(false\)/,
  );
  assert.match(source, /isCompactSettings \? \(/);
  assert.match(
    source,
    /<DropdownMenuItem[\s\S]*aria-expanded=\{mobileNavigationTabsOpen\}[\s\S]*onSelect=\{\(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*setMobileNavigationTabsOpen\(\(open\) => !open\);[\s\S]*Navigation tabs[\s\S]*<ChevronDown[\s\S]*mobileNavigationTabsOpen && \([\s\S]*<NavigationTabItems/,
  );
  assert.match(
    source,
    /\) : \([\s\S]*<DropdownMenuSub>[\s\S]*<DropdownMenuSubTrigger>[\s\S]*Navigation tabs[\s\S]*<DropdownMenuPortal>[\s\S]*<NavigationTabItems/,
  );
});

test("mobile settings end with a focusable GitHub developer credit", () => {
  const reportBugIndex = source.indexOf("Report a Bug");
  const creditIndex = source.indexOf('href="https://github.com/M1Vj"');
  const contentEndIndex = source.indexOf("</DropdownMenuContent>");
  const creditItemIndex = source.lastIndexOf("<DropdownMenuItem", creditIndex);
  const finalItemIndex = source.lastIndexOf("<DropdownMenuItem", contentEndIndex);

  assert.ok(reportBugIndex >= 0);
  assert.ok(creditIndex > reportBugIndex);
  assert.ok(contentEndIndex > creditIndex);
  assert.equal(finalItemIndex, creditItemIndex);
  assert.match(
    source.slice(reportBugIndex, contentEndIndex),
    /Report a Bug[\s\S]*\{isCompactSettings && \([\s\S]*<DropdownMenuSeparator \/>[\s\S]*<DropdownMenuItem asChild[\s\S]*<a[\s\S]*href="https:\/\/github\.com\/M1Vj"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"[\s\S]*Developed by M1Vj/,
  );
});
