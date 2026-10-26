# Changelog

## 1.0.1 — 2026-10-26

- Add a manual **Lumen → Updates** page using the installed package's version and format metadata.
- Select a newer stable target and show every intervening published release in semantic-version order, with separate notes for each version.
- Fetch the public GitHub API only on request, without credentials, tokens or polling. Bound requests to 10 pages of 100 releases and a 30-second total GitHub-request deadline.
- Report timeouts, rate limits, incomplete history and unrecognized release data explicitly; never interpret a failed check as “up to date.”
- Render release notes as text and restrict download links to this repository's corresponding Release assets. Downloads do not install packages or change router settings.
- Discover the accessible LuCI package-manager route instead of assuming a route from APK/IPK format.
- Build APK (`noarch`, SDK 25.12.6) and IPK (`all`, SDK 24.10.8) packages for matching ucode LuCI environments, with separate Simplified Chinese packages and signature-verification documentation.
- Preserve theme registration during upgrades; on removal, clean the Lumen registration and restore Bootstrap if Lumen is still selected.

Validated: source checks, 14 update behavior-test groups, and the real update view with synthetic data in Chromium at 320, 390 and 1280 px in light and dark modes. Selecting 1.1.0 from the demo's installed 1.0.0 displays three release sections; selecting 1.0.2 displays two. No horizontal overflow or JavaScript errors were observed in those render checks.

Both SDK jobs in [run 40257353620](https://github.com/qidlek114/luci-theme-lumen/actions/runs/40257353620) succeeded for source `8fe1399f`. Checks cover source correspondence for 235 runtime files per format and 168 Chinese catalogue entries. OpenWrt 24.10.8 IPK and 25.12.6 APK isolated signed install, fixture-based upgrade and removal checks passed with UCI preservation. IPK checks also cover activation and active/inactive removal. Both environments preserved the recorded network, firewall and DHCP configuration file content and absence states. Native APK signature verification passed, while an empty trust directory and an actual payload-byte modification were rejected.

A five-file update-page deployment on a live OpenWrt 25.12.6 device confirmed the Chinese interface and a manual GitHub query without changing the proxy. Full release-package installation on the router, full boot/reboot behavior and broader firmware compatibility are not established. See [validation details](docs/VALIDATION.md); no bit-reproducibility claim is made. Source archives remain non-installable source code.

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
