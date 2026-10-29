# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Lumen contributors

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-lumen
PKG_VERSION:=1.0.4
PKG_RELEASE:=1
PKG_PO_VERSION:=1.0.4
PKG_LICENSE:=Apache-2.0 ISC MIT OFL-1.1
PKG_LICENSE_FILES:=root/usr/share/doc/luci-theme-lumen/LICENSE root/usr/share/doc/luci-theme-lumen/NOTICE root/usr/share/doc/luci-theme-lumen/licenses/Lucide-LICENSE root/usr/share/doc/luci-theme-lumen/licenses/Source-Serif-OFL.md

LUCI_TITLE:=Lumen theme with dashboard and appearance settings
LUCI_DESCRIPTION:=Responsive LuCI theme for the ucode runtime, with local icons and optional self-hosted fonts.
LUCI_DEPENDS:=+luci-base +luci-mod-status +luci-theme-bootstrap +curl +usign +rpcd-mod-ucode
LUCI_PKGARCH:=all
LUCI_URL:=https://github.com/qidlek114/luci-theme-lumen
LUCI_MAINTAINER:=Lumen contributors

# Preserve modern CSS/JS syntax; ship reviewed source without an older minifier.
LUCI_MINIFY_CSS:=0
LUCI_MINIFY_JS:=0

# Build metadata is generated from the actual SDK configuration, not the host.
define Build/Prepare/luci-theme-lumen
	$(INSTALL_DIR) $(PKG_BUILD_DIR)/htdocs/luci-static/resources/lumen
	printf '%s\n' '{"version":"$(PKG_VERSION)","format":"$(if $(CONFIG_USE_APK),apk,ipk)"}' > $(PKG_BUILD_DIR)/htdocs/luci-static/resources/lumen/version.json
	# Keep the optional fonts outside htdocs before luci.mk installs the theme.
	$(INSTALL_DIR) $(PKG_BUILD_DIR)/lumen-fonts
	mv $(PKG_BUILD_DIR)/htdocs/luci-static/lumen/fonts.css $(PKG_BUILD_DIR)/lumen-fonts/
	mv $(PKG_BUILD_DIR)/htdocs/luci-static/lumen/fonts $(PKG_BUILD_DIR)/lumen-fonts/
endef

define Package/luci-theme-lumen/conffiles
/etc/config/lumen
endef

define Package/luci-theme-lumen/postrm
#!/bin/sh
# opkg invokes the old package postrm during upgrades; keep its registration.
[ "$${1:-}" != upgrade ] || exit 0
[ -n "$${IPKG_INSTROOT}" ] || {
	# Keep LuCI usable if the active theme is explicitly uninstalled.
	if [ "$$(uci -q get luci.main.mediaurlbase)" = '/luci-static/lumen' ]; then
		uci set luci.main.mediaurlbase='/luci-static/bootstrap'
	fi
	if [ "$$(uci -q get luci.themes.Lumen)" = '/luci-static/lumen' ]; then
		uci -q delete luci.themes.Lumen
	fi
	uci commit luci
}
exit 0
endef

# Supports a standalone checkout in package/ or a LuCI feed checkout.
include $(if $(wildcard ../../luci.mk),../../luci.mk,$(TOPDIR)/feeds/luci/luci.mk)

define Package/luci-theme-lumen-fonts
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=4. Themes
  TITLE:=Optional self-hosted fonts for Lumen
  DEPENDS:=+luci-theme-lumen
  VERSION:=$(PKG_VERSION)-r$(PKG_RELEASE)
  PKGARCH:=all
  URL:=$(LUCI_URL)
  MAINTAINER:=$(LUCI_MAINTAINER)
endef

define Package/luci-theme-lumen-fonts/description
  Optional Noto Serif SC and Source Serif 4 fonts for the Lumen theme.
endef

define Package/luci-theme-lumen-fonts/install
	$(INSTALL_DIR) $(1)/www/luci-static/lumen
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/lumen-fonts/fonts.css $(1)/www/luci-static/lumen/
	$(CP) $(PKG_BUILD_DIR)/lumen-fonts/fonts $(1)/www/luci-static/lumen/
endef

$(eval $(call BuildPackage,luci-theme-lumen-fonts))
