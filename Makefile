# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 Lumen contributors

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-lumen
PKG_VERSION:=1.0.1
PKG_RELEASE:=1
PKG_PO_VERSION:=1.0.1
PKG_LICENSE:=Apache-2.0 ISC MIT OFL-1.1
PKG_LICENSE_FILES:=root/usr/share/doc/luci-theme-lumen/LICENSE root/usr/share/doc/luci-theme-lumen/NOTICE root/usr/share/doc/luci-theme-lumen/licenses/Lucide-LICENSE root/usr/share/doc/luci-theme-lumen/licenses/Source-Serif-OFL.md

LUCI_TITLE:=Lumen theme with dashboard and appearance settings
LUCI_DESCRIPTION:=Responsive LuCI theme for the ucode runtime, with locally hosted fonts and icons.
LUCI_DEPENDS:=+luci-base +luci-mod-status +luci-theme-bootstrap
LUCI_PKGARCH:=all
LUCI_URL:=https://github.com/qidlek114/luci-theme-lumen
LUCI_MAINTAINER:=Lumen contributors

# Preserve modern CSS/JS syntax; ship reviewed source without an older minifier.
LUCI_MINIFY_CSS:=0
LUCI_MINIFY_JS:=0

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

# call BuildPackage - OpenWrt buildroot signature
