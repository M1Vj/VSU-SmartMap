# Mobile Chat and Settings Refinement Design

**Status:** Approved by the product owner's explicit layout direction and autonomy instruction

## Goal

Make the mobile Chat and Settings surfaces feel like one intentional application:

- Chat owns its accuracy guidance and usage status.
- The fixed mobile navigation is not visually joined to a developer-credit strip.
- Settings exposes navigation-tab controls as an inline disclosure instead of a nested popup.
- The developer credit remains available without occupying scarce mobile page space.

## Chat Composer

`ChatInput` remains the single owner of message entry, rate-limit feedback, the character counter, and the accuracy helper.

The bordered relative field wrapper starts with a compact row containing a persistent prompt label on the left. When quota data is available, a short usage label appears on the right:

- Positive quota: `6 chats left`
- Exhausted quota: `Limit reached`

The full-width textarea sits below that row, with the character counter independently positioned at the lower-right and protected by bottom padding. This preserves the full typing width instead of reserving horizontal space on every line. At narrow phone widths, the labels remain concise and the textarea keeps a 16px font to avoid iOS input zoom.

The exact helper text, `AI answers may be inaccurate. Verify important details.`, stays in normal flow immediately below the form. It is the last row owned by the Chat composer and never uses fixed or absolute page positioning. This keeps it visually attached to Chat while the fixed navigation remains a separate application control.

## Mobile Settings

The existing Settings dropdown remains the only mobile settings surface. Its `Navigation tabs` row becomes an accessible disclosure:

- It is collapsed by default.
- Activating it toggles `aria-expanded`.
- The tab checkboxes render directly below it inside the same dropdown content.
- No nested popup, submenu, dialog, or portal is used on mobile.
- Selecting tab checkboxes does not close the Settings menu.
- Desktop retains the existing nested submenu because pointer and keyboard space are sufficient there.

The mobile menu may grow vertically when the disclosure opens. The dropdown content therefore receives a viewport-bounded maximum height and vertical scrolling so all controls remain reachable on short devices.

## Developer Credit

On student-facing mobile routes, the global `SiteCredit` footer is hidden and reserves no height above the fixed navigation.

The link `Developed by Vj F Mabansag` appears as the final mobile-only item in Settings, after the functional settings and reporting actions. It keeps the existing GitHub destination, new-tab behavior, and safe link attributes.

Desktop pages retain the existing tiny, centered, transparent global credit. The map's Leaflet attribution remains unchanged.

## Accessibility

- The disclosure is a real button-like dropdown item with an accessible expanded state.
- The expanded controls remain keyboard reachable.
- The prompt is a real label associated with the textarea. Quota is supporting text, while exhausted quota is represented by the disabled input state and the dynamic `Daily chat limit reached` label.
- The developer link has a visible focus state and descriptive text.
- Existing 44px mobile send target and 16px textarea font remain unchanged.

## Verification

Automated tests will assert:

- the quota renders inside the textarea field wrapper and uses concise copy;
- the accuracy helper remains in Chat-owned normal flow;
- mobile Settings uses an `aria-expanded` inline disclosure without a mobile submenu;
- the developer link is the last mobile Settings section;
- the global credit is hidden on mobile student routes without reserving mobile-navigation space;
- the desktop credit and map attribution remain intact.

Runtime checks cover 320px, 375px, and 390px mobile widths plus a desktop width. They verify no overlap, horizontal overflow, or gap above the fixed navigation; disclosure expansion in place; tab toggling without menu dismissal; and desktop-credit preservation.
