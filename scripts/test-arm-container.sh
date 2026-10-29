#!/bin/sh
# Invoked only in a disposable OpenWrt container with no network access.
set -eux
format="$1"
arch="$2"
case "$arch:$(uname -m)" in
  armv8:aarch64|armv7:armv7l|armv7:armv8l|x86_64:x86_64) ;;
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

# Release validation uses the final signed files, not the temporary test keys.
# The host runner also matches both public keys against the checked-in copies.
if [ -d /fixtures/final-release ]; then
  (cd /fixtures/final-release && sha256sum -c SHA256SUMS)
  if [ "$format" = ipk ]; then
    (cd /fixtures/final-release && usign -V -p lumen-usign.pub -m SHA256SUMS -x SHA256SUMS.sig)
    if usign -V -p /fixtures/old/lumen-usign.pub -m /fixtures/final-release/SHA256SUMS -x /fixtures/final-release/SHA256SUMS.sig; then
      echo 'The previous usign key unexpectedly accepted the new release.' >&2; exit 1
    fi
  fi
fi

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
  if [ -d /fixtures/final-release ] && apk --keys-dir /tmp/old-keys verify "$new_theme"; then
    echo 'The previous APK key unexpectedly accepted the new release.' >&2; exit 1
  fi
  if apk --keys-dir /tmp/empty-keys verify "$new_theme"; then
    echo 'Unsigned trust-directory negative check unexpectedly passed.' >&2; exit 1
  fi
  cp /tmp/old-keys/lumen-apk.pub /tmp/test-keys/lumen-test.pub /etc/apk/keys/
  install_packages() { apk --no-network add "$@"; }
  remove_packages() { apk --no-network del "$@"; }
else
  # In a booted router /var is backed by /tmp and initialized by procd.
  # A rootfs imported directly into a container has no boot sequence.
  mkdir -p /var/lock
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
# opkg may retain the now-empty directory after removing the old font files.
if [ -d /www/luci-static/lumen/fonts ]; then
  test -z "$(find /www/luci-static/lumen/fonts -type f -print -quit)"
fi
ucode -T -c /usr/share/ucode/luci/template/themes/lumen/header.ut > /tmp/lumen-header.uc
ucode -c /usr/share/rpcd/ucode/lumen.update > /tmp/lumen-rpc.uc

# Roll back with the real package manager while offline, then upgrade again.
# This exercises signed APK downgrade and the opkg no-feed configuration;
# the container does not claim a real device reboot or browser acceptance.
if [ "$format" = apk ]; then
  apk --network=no --cache=no --repositories-file /dev/null add --simulate "$old_theme" "$old_zh"
  apk --network=no --cache=no --repositories-file /dev/null add "$old_theme" "$old_zh"
else
  mkdir -p /tmp/lumen-opkg-empty /tmp/lumen-opkg-lists
  {
    printf 'dest root /\ndest ram /tmp\nlists_dir ext /tmp/lumen-opkg-lists\n'
    opkg print-architecture | awk '/^arch [A-Za-z0-9_+-]+ [0-9]+$/ {print}'
  } > /tmp/lumen-opkg.conf
  OPKG_CONF_DIR=/tmp/lumen-opkg-empty opkg --conf /tmp/lumen-opkg.conf --force-downgrade --noaction install "$old_theme" "$old_zh"
  OPKG_CONF_DIR=/tmp/lumen-opkg-empty opkg --conf /tmp/lumen-opkg.conf --force-downgrade install "$old_theme" "$old_zh"
fi
[ "$(uci get lumen.main.style)" = 'claude' ]
[ "$(uci get luci.main.mediaurlbase)" = '/luci-static/lumen' ]
test -f /www/luci-static/lumen/fonts.css
install_packages "$new_theme" "$new_zh"
test ! -e /www/luci-static/lumen/fonts.css
[ "$(uci get luci.main.mediaurlbase)" = '/luci-static/lumen' ]

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
echo "PASS: old release upgrade and downgrade, config preservation, font add/remove, theme fallback and fresh installation"
