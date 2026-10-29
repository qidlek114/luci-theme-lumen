#!/bin/sh
# Invoked only in a disposable OpenWrt container with no network access.
set -eu
format="$1"
arch="$2"
case "$arch:$(uname -m)" in
  armv8:aarch64|armv7:armv7l|armv7:armv8l) ;;
  *) echo "Unexpected target architecture: $arch / $(uname -m)" >&2; exit 1 ;;
esac
echo "Testing $format on $(uname -m) with a 128 MiB container memory limit"

# Rootfs defaults are synthetic. Confirm package operations do not alter these
# files; this is not a forwarding, connectivity, or whole-device boot test.
snapshot() {
  for file in /etc/config/network /etc/config/firewall /etc/config/dhcp; do
    if [ -f "$file" ]; then sha256sum "$file"; else echo "absent $file"; fi
  done
}
snapshot > /tmp/network-before

if [ "$format" = apk ]; then
  old_theme=/fixtures/old/luci-theme-lumen-1.0.1-r1.apk
  old_zh=/fixtures/old/luci-i18n-lumen-zh-cn-1.0.1.apk
  set -- /fixtures/new-apk/luci-theme-lumen-[0-9]*.apk; [ "$#" = 1 ] && [ -f "$1" ]; new_theme="$1"
  set -- /fixtures/new-apk/luci-theme-lumen-fonts-*.apk; [ "$#" = 1 ] && [ -f "$1" ]; new_fonts="$1"
  set -- /fixtures/new-apk/luci-i18n-lumen-zh-cn-*.apk; [ "$#" = 1 ] && [ -f "$1" ]; new_zh="$1"
  (cd /fixtures/new-apk && sha256sum -c ../test-apk-sha256)
  mkdir -p /tmp/old-keys /tmp/test-keys /tmp/empty-keys
  cp /fixtures/old/lumen-apk.pub /tmp/old-keys/
  cp /fixtures/test-keys/lumen-test.pub /tmp/test-keys/
  apk --keys-dir /tmp/old-keys verify "$old_theme" "$old_zh"
  apk --keys-dir /tmp/test-keys verify "$new_theme" "$new_fonts" "$new_zh"
  if apk --keys-dir /tmp/empty-keys verify "$new_theme"; then
    echo 'Unsigned trust-directory negative check unexpectedly passed.' >&2; exit 1
  fi
  cp /tmp/old-keys/lumen-apk.pub /tmp/test-keys/lumen-test.pub /etc/apk/keys/
  install_packages() { apk --no-network add "$@"; }
  remove_packages() { apk --no-network del "$@"; }
else
  old_theme=/fixtures/old/luci-theme-lumen_1.0.1-r1_all.ipk
  old_zh=/fixtures/old/luci-i18n-lumen-zh-cn_1.0.1_all.ipk
  set -- /fixtures/new-ipk/luci-theme-lumen_[0-9]*.ipk; [ "$#" = 1 ] && [ -f "$1" ]; new_theme="$1"
  set -- /fixtures/new-ipk/luci-theme-lumen-fonts_*.ipk; [ "$#" = 1 ] && [ -f "$1" ]; new_fonts="$1"
  set -- /fixtures/new-ipk/luci-i18n-lumen-zh-cn_*.ipk; [ "$#" = 1 ] && [ -f "$1" ]; new_zh="$1"
  (cd /fixtures/new-ipk && sha256sum -c SHA256SUMS.build)
  (
    cd /fixtures/old
    usign -V -p lumen-usign.pub -m SHA256SUMS -x SHA256SUMS.sig
    awk '$2=="luci-theme-lumen_1.0.1-r1_all.ipk" || $2=="luci-i18n-lumen-zh-cn_1.0.1_all.ipk" {print; n++} END {if(n!=2) exit 1}' SHA256SUMS > /tmp/old-ipk.sha256
    sha256sum -c /tmp/old-ipk.sha256
  )
  install_packages() { opkg install "$@"; }
  remove_packages() { opkg remove "$@"; }
fi

install_packages "$old_theme" "$old_zh"
test -f /www/luci-static/lumen/fonts.css
uci set lumen.main.style='claude'
uci commit lumen
uci set luci.main.mediaurlbase='/luci-static/lumen'
uci commit luci

# Upgrade from the previous full-font release to the new core.
install_packages "$new_theme" "$new_zh"
[ "$(uci get lumen.main.style)" = 'claude' ]
[ "$(uci get luci.main.mediaurlbase)" = '/luci-static/lumen' ]
test -f /www/luci-static/lumen/lumen.css
test -f /usr/share/ucode/luci/template/themes/lumen/header.ut
test ! -e /www/luci-static/lumen/fonts.css
test ! -e /www/luci-static/lumen/fonts
ucode -T -c /usr/share/ucode/luci/template/themes/lumen/header.ut > /tmp/lumen-header.uc

install_packages "$new_fonts"
test -f /www/luci-static/lumen/fonts.css
[ "$(find /www/luci-static/lumen/fonts -name '*.woff2' | wc -l | tr -d ' ')" = 208 ]
remove_packages luci-theme-lumen-fonts
test ! -e /www/luci-static/lumen/fonts.css
test -f /www/luci-static/lumen/lumen.css

remove_packages luci-i18n-lumen-zh-cn luci-theme-lumen
[ "$(uci get luci.main.mediaurlbase)" = '/luci-static/bootstrap' ]
install_packages "$new_theme" "$new_zh"
test -f /www/luci-static/lumen/lumen.css
test ! -e /www/luci-static/lumen/fonts.css

snapshot > /tmp/network-after
cmp /tmp/network-before /tmp/network-after
echo "PASS: old release upgrade, config preservation, font add/remove, theme fallback and fresh installation"
