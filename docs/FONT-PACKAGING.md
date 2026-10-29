# Font packaging: development notes

The 1.0.2 source separates the existing Noto Serif SC and Source Serif 4 files
from the main `luci-theme-lumen` package. The optional
`luci-theme-lumen-fonts` package depends on the theme and restores the original
self-hosted typography. Without it, the interface uses fonts available on the
device viewing LuCI; Chinese typography can therefore vary by platform. Neither
choice requires an external font service.

The header checks whether the optional stylesheet exists before requesting it
or preloading a font. Each package owns different paths, so the optional package
does not replace files belonging to the main package. Installing or removing the
optional package takes effect after a page reload.

In this source snapshot, the uncompressed `htdocs/` and `root/` runtime files
total 7,051,790 bytes. Moving the font stylesheet and font files to the optional
package leaves approximately 324,251 bytes in the core and 6,727,539 bytes in
the font package, a core reduction of about 95%. These are source-file totals,
not measured APK/IPK sizes or free-space requirements: package metadata,
translations, dependencies, filesystem allocation and upgrades add overhead.

The staging check runs the package preparation and optional-font install recipes
for both format settings, checks all 208 font assets and their licenses, and
confirms the core has no bundled fonts. The SDK workflow separately builds APK
and IPK packages from a committed source tree using `git archive`. It rejects an
unclean checkout so that local changes cannot be silently omitted. Its isolated
package tests exercise installation and upgrades using test-signed copies.

Before publishing a new package, verify it with the matching OpenWrt SDK and
test installation, upgrade from 1.0.1, optional-font installation/removal and
theme fallback in an isolated environment. Validate release signatures and
include the font-package asset in the signed release manifest. An isolated
rootfs test does not establish physical-device boot, browser acceptance or
whole-router low-memory performance.

The existing v1.0.1 release remains unchanged and still bundles its fonts in the
theme package. Firmware compatibility depends on the LuCI runtime and package
format, not just the CPU architecture.
