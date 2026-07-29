import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./settings-dropdown.tsx", import.meta.url),
  "utf8",
);

test("mobile navigation tabs use an inline disclosure while desktop keeps its submenu", () => {
  const compactBranchStart = source.indexOf("{isCompactSettings ? (");
  const desktopBranchStart = source.indexOf(") : (", compactBranchStart);
  const compactBranch = source.slice(compactBranchStart, desktopBranchStart);

  assert.match(source, /MOBILE_SETTINGS_QUERY = "\(max-width: 767px\)"/);
  assert.match(
    source,
    /const \[mobileNavigationTabsOpen, setMobileNavigationTabsOpen\] = useState\(false\)/,
  );
  assert.ok(compactBranchStart >= 0);
  assert.ok(desktopBranchStart > compactBranchStart);
  assert.doesNotMatch(compactBranch, /DropdownMenuSub|DropdownMenuPortal/);
  assert.match(
    compactBranch,
    /<DropdownMenuItem[\s\S]*aria-expanded=\{mobileNavigationTabsOpen\}[\s\S]*onSelect=\{\(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*setMobileNavigationTabsOpen\(\(open\) => !open\);[\s\S]*Navigation tabs[\s\S]*<ChevronDown[\s\S]*mobileNavigationTabsOpen && \([\s\S]*<NavigationTabItems/,
  );
  assert.match(
    source,
    /<DropdownMenuCheckboxItem[\s\S]*onSelect=\{\(event\) => event\.preventDefault\(\)\}/,
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
  assert.doesNotMatch(
    source.slice(creditItemIndex, contentEndIndex),
    /text-muted-foreground/,
  );
  assert.match(
    source.slice(reportBugIndex, contentEndIndex),
    /Report a Bug[\s\S]*\{isCompactSettings && \([\s\S]*<DropdownMenuSeparator \/>[\s\S]*<DropdownMenuItem asChild className="[^"]*justify-center[^"]*text-\[10px\][^"]*text-foreground[^"]*md:hidden[^"]*"[\s\S]*<a[\s\S]*href="https:\/\/github\.com\/M1Vj"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"[\s\S]*className="[^"]*justify-center[^"]*text-center[^"]*"[\s\S]*Developed by Vj F Mabansag/,
  );
});
