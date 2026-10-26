<p align="center"><img src="docs/branding/logo.svg" width="72" height="72" alt="Lumen colored router icon"></p>

# Lumen for LuCI

[![Validate source](https://github.com/qidlek114/luci-theme-lumen/actions/workflows/validate.yml/badge.svg)](https://github.com/qidlek114/luci-theme-lumen/actions/workflows/validate.yml)

A responsive theme for modern OpenWrt LuCI, with light and dark appearances, a clear sidebar, a dashboard and live charts.

[简体中文](README.md) · [Releases](https://github.com/qidlek114/luci-theme-lumen/releases) · [Issues](https://github.com/qidlek114/luci-theme-lumen/issues) · [Contributing](CONTRIBUTING.md)

![Dark desktop appearance with synthetic demo data](docs/screenshots/desktop-dark.png)

## Features

- Light, dark or system colour mode, with two appearance presets.
- Dedicated Lumen dashboard, load / bandwidth / connection charts and appearance settings.
- Device identity, interfaces and metrics read from the system; optional display-name overrides.
- Responsive tables, long text, action buttons and status cards.
- Locally hosted fonts and SVG icons; no external font or icon CDN.
- English and editable Simplified Chinese PO translations.
- Manual GitHub update checks, target-version selection and all intervening stable release notes, with matching package downloads and no automatic installation.

![Light desktop appearance with synthetic demo data](docs/screenshots/desktop-light.png)

<img src="docs/screenshots/mobile.png" width="360" alt="Mobile layout with synthetic demo data">

**All screenshots use synthetic demonstration data. They are not device benchmarks or live network records.**

## Compatibility and validation

v1.0.1 targets **ucode-based LuCI**, with OpenWrt SDK 25.12.6 for APK (`noarch`) and SDK 24.10.8 for IPK (`all`). Architecture-independent resources still require a matching package format and LuCI runtime. Dependencies are `luci-base`, `luci-mod-status` and `luci-theme-bootstrap` as an uninstall fallback. There is no proxy, Docker, ad-blocker or device-specific dependency. Built-in LuCI routes remain intact; additional pages live under `admin/lumen/`.

Both SDK builds succeeded. Source correspondence checks cover 235 runtime files in each format, and all 168 Chinese catalogue entries passed verification. Isolated IPK checks on OpenWrt 24.10.8 and APK checks on 25.12.6 cover signature-checked installation, upgrade from an older-version fixture preserving UCI configuration, and removal. IPK checks additionally cover activation, appearance/selection preservation and active/inactive theme removal. Native APK signature verification passed; untrusted-key and modified-payload controls were rejected. Source/update behavior tests and Chromium demo rendering at 320, 390 and 1280 px in both color modes also passed.

On a live OpenWrt 25.12.6 device, only five update-page UI files were deployed. A real browser confirmed the Chinese interface and manual GitHub query; the proxy remained unchanged. **No complete release-package installation was performed on the router, and neither the isolated environments nor the router underwent a full boot/reboot test.** These results do not establish universal firmware/browser compatibility or bit-reproducible builds. See the [validation record](docs/VALIDATION.md) for provenance, exact scope and limits. Older Lua LuCI is unsupported; vendor-specific pages and future LuCI releases are outside the verified scope.

Bundled fonts occupy approximately 6.53 MB uncompressed, in addition to scripts, styles and templates. Allow space for installation and upgrades.

## Build from source

Prepare the OpenWrt SDK or source tree matching your target firmware using the official build instructions. The v1.0.1 target SDKs are 25.12.6 and 24.10.8. From its root:

```sh
./scripts/feeds update -a
./scripts/feeds install -a
git clone --branch v1.0.1 --depth 1 https://github.com/qidlek114/luci-theme-lumen.git package/luci-theme-lumen
make menuconfig
make package/luci-theme-lumen/compile V=s
```

Select `LuCI → Themes → luci-theme-lumen`. Enable Simplified Chinese under LuCI translations if required. Standard `luci.mk` generates `luci-theme-lumen` and the optional `luci-i18n-lumen-zh-cn` package, which installs `lumen.zh-cn.lmo`. Outputs are under `bin/packages/` in the SDK.

Theme resources are architecture-independent, but package format and LuCI APIs must match the target. **A source ZIP or tar.gz is not an installable APK or IPK.** Check the corresponding Release assets and validation notes for package availability and tested scope. v1.0.0 remains a source-only release.

## Install and activate

1. Keep a working fallback theme and record its selection. Test on a recoverable device first.
2. Obtain the matching theme and optional Chinese package from the corresponding [Release](https://github.com/qidlek114/luci-theme-lumen/releases), then follow the [installation and signature-verification guide](docs/INSTALL.md). APKs use native project signatures. For IPKs, verify the usign-signed checksum manifest before checking the package contents. SHA-256 alone does not authenticate the publisher. Keep HTTPS certificate and package-signature verification enabled.
3. Standard LuCI post-install handling may clear LuCI caches and reload `rpcd` to activate ACLs. It does not restart network, firewall or proxy services. Log in again to refresh the session and menu.
4. Select **Lumen** manually under **System → System → Language and Style**. Installation registers the theme without selecting it.
5. Use **Lumen → Appearance** for visual settings and **Lumen → Dashboard / Realtime Graphs** for metrics.

Default `/etc/config/lumen`:

```uci
config theme 'main'
    option style 'default'
    option mode 'auto'
```

`style` accepts `default` or `claude`; `mode` accepts `auto`, `light` or `dark`. Optional `hostname` and `model` override only the displayed identity; empty values use detected system information. This file is registered as a configuration file so the package manager can preserve local edits during upgrades.

## Check for updates manually

Open **Lumen → Updates** and press **Check GitHub for updates**. The page reads the installed version and APK/IPK format from local package metadata. Only pressing the button contacts this project's public GitHub API from the current browser, without login credentials or tokens. There is no polling or new backend installation permission.

Select a published stable version newer than the installed version. The page displays every published stable release **after the installed version and up to the target**, ordered by version. For example, selecting 1.1.0 from 1.0.0 includes published releases 1.0.1, 1.0.2 and 1.1.0, rather than only the target's notes. Drafts and prereleases are excluded; missing notes are explicitly identified. Release text is rendered as plain text, without executing HTML.

A check reads at most 10 pages of 100 releases, with a 30-second total deadline for GitHub requests. Timeouts, rate limits, truncated history, unrecognized stable tags or incomplete data produce an explicit unknown-status warning and disable version selection/downloads. They are never reported as “up to date.”

Downloads are limited to this repository's target Release assets: matching theme and Chinese packages, plus any provided verification keys and checksum files. **Matching the package format does not establish firmware compatibility, and downloads do not install anything.** Review requirements and verify signatures before confirming installation in LuCI's Software page. Its link is discovered from the accessible menu rather than inferred from the package format.

<details>
<summary>Update page demo with sample release history</summary>

![Update page demo with sample release history, not actual published releases](docs/screenshots/updates-demo.png)

The 1.0.0, 1.0.1, 1.0.2 and 1.1.0 entries illustrate accumulated release notes. They do not establish that those versions have been published.

</details>

## Revert or uninstall

Prefer selecting an installed fallback theme in LuCI before uninstalling Lumen and its translation package. If Lumen is still selected when removed, the uninstall hook restores Bootstrap, which is retained as a dependency. If the web interface is unavailable, use an existing management connection to restore the recorded `luci.main.mediaurlbase` value, commit the `luci` configuration and refresh the browser. There is no need to change network, DNS or proxy configuration.

## Public-source audit

- Extracted theme resources into a standalone package without router backups, real host inventories, network settings or proxy configuration.
- Removed deployment-specific display values; links use LuCI URL generation and metrics use detected system interfaces.
- Moved custom views under `admin/lumen/` instead of replacing native status routes; installation does not select the theme.
- Scoped ACLs to required read-only metrics and writes to the `lumen` appearance configuration.
- Included the chart dependency, editable Chinese catalogue and upstream licenses/attribution.

This is not a security certification or a claim that every third-party LuCI app has been tested. Report firmware, LuCI and browser versions, the page path, and a privacy-safe screenshot when filing an issue.

## Development

```sh
node scripts/check.mjs
```

`htdocs/` maps to `/www/`, `root/` maps to the system root, and LuCI compiles `po/zh_Hans/lumen.po` into a separate translation package. No device configuration or remote one-line installer is distributed.

## License

Original Lumen code is [Apache-2.0](LICENSE). The Bootstrap foundation is Apache-2.0, Lucide/Feather icons are ISC/MIT, and bundled fonts are SIL OFL 1.1. See [NOTICE](NOTICE) and [licenses](licenses) for attribution and complete terms.
