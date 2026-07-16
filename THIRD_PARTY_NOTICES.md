# Third-party notices

Campus SmartMap is MIT-licensed, but its npm dependencies and external data
services retain their own licenses and terms. `package-lock.json` records the
exact dependency graph used for a release; distributed packages include their
upstream license files.

Notable production dependency licenses identified by the release audit include
MIT, Apache-2.0, ISC, BSD, MPL-2.0 (`@vercel/analytics`), LGPL-3.0-or-later
(`@img/sharp-libvips-*` binary packages), CC-BY-4.0 (`caniuse-lite` data), and
dual-licensed packages such as `jszip` (MIT or GPL-3.0-or-later). Campus
SmartMap uses the permissive option where a dependency offers a choice.

Basemap tiles, routing services, university names and marks, and user-submitted
media are not relicensed by this repository. See `docs/DATA_AND_ASSETS.md` and
the provider attribution shown in the application.
