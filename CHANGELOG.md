# Changelog

## 1.0.0 — 2026-10-26

Initial public source release of Lumen for ucode-based OpenWrt LuCI.

- Light, dark and system colour modes; default and paper/carbon appearance presets.
- Dashboard, realtime charts and appearance settings in the `admin/lumen/` namespace.
- Self-hosted fonts and icons, editable Simplified Chinese translations and complete component notices.
- Generic defaults and dynamic device identity; active IPv4/IPv6 uplink discovery.
- LuCI-aware navigation, preserved legacy preferences and Safari media-query fallback.
- Wrapped dashboard badges and readable chart headings down to a 320 px viewport.
- Standard OpenWrt package sources, validation workflow and screenshots using synthetic data.

Validated: JavaScript/JSON checks, portability behavior tests, ucode template compilation,
local asset availability and Chromium desktop/mobile rendering at 1440, 390 and 320 px.
This source release has not yet undergone a fresh SDK package build/install or reboot test.
No prebuilt APK/IPK package is included; release archives contain source code.
