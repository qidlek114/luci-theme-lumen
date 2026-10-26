#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Build installable packages with pinned, authenticated official OpenWrt SDKs.
# No signing secret is accepted or copied by this script.
set -euo pipefail
umask 022

release="${1:-}"
case "$release" in
  25.12.6)
    sdk_file='openwrt-sdk-25.12.6-x86-64_gcc-14.3.0_musl.Linux-x86_64.tar.zst'
    sdk_hash='1864152619092e781fa36a401960c8e9ae42d6a364c44ee5f0b197ca5f3c0fcc'
    feeds_hash='037f68494e8cf059f7cb49dbce7e0f73a3da4db1e73b2b8b7477ff2d2676f40b'
    luci_commit='75a306df84a020c57a631ef5b4c02ace56d93387'
    format='apk'
    ;;
  24.10.8)
    sdk_file='openwrt-sdk-24.10.8-x86-64_gcc-13.3.0_musl.Linux-x86_64.tar.zst'
    sdk_hash='ac4a0405d2eea821b06f93c14ba13ffa90ad0457648903df7dde02570027ab21'
    feeds_hash='8abf2a8ca51671f8bae637cfc79d8dc2a07d9d5029f1f97c18e46a91d7760da3'
    luci_commit='cac97ed67cfbcad90db49f5f3b1245c2c4cbfae5'
    format='ipk'
    ;;
  *) printf 'Usage: %s {25.12.6|24.10.8}\n' "$0" >&2; exit 2 ;;
esac

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
source_commit="$(git -C "$repo_root" rev-parse HEAD)"
source_epoch="$(git -C "$repo_root" show -s --format=%ct HEAD)"
dist="$repo_root/dist/openwrt-$release"
tools_dist="$repo_root/validation-tools/openwrt-$release"
[[ ! -e "$dist" && ! -e "$tools_dist" ]] || {
  echo 'Output already exists; choose a clean checkout to avoid mixing builds.' >&2; exit 1;
}
build_root="$(mktemp -d "${RUNNER_TEMP:-/tmp}/lumen-sdk.XXXXXXXX")"
trap 'rm -rf -- "$build_root"' EXIT
base_url="https://downloads.openwrt.org/releases/$release/targets/x86/64"
primary_key='8A8BC12F46B836C0F9CDB36F1D53D1877742E911'
signing_subkey='92C561DE55AE6552F3C736B82B0151090606D1D9'
download() { curl --fail --location --retry 3 --proto '=https' --tlsv1.2 "$1" -o "$2"; }

mkdir -m 700 "$build_root/gnupg"
download 'https://git.openwrt.org/keyring/plain/gpg/0x1D53D1877742E911.asc' "$build_root/openwrt-build-key.asc"
key_fingerprint="$(gpg --homedir "$build_root/gnupg" --batch --show-keys --with-colons "$build_root/openwrt-build-key.asc" | awk -F: '$1=="fpr" { print $10; exit }')"
[[ "$key_fingerprint" == "$primary_key" ]] || { echo 'Unexpected OpenWrt signing key.' >&2; exit 1; }
gpg --homedir "$build_root/gnupg" --batch --import "$build_root/openwrt-build-key.asc"
download "$base_url/sha256sums" "$build_root/sha256sums"
download "$base_url/sha256sums.asc" "$build_root/sha256sums.asc"
gpg --homedir "$build_root/gnupg" --batch --status-fd 1 --verify "$build_root/sha256sums.asc" "$build_root/sha256sums" > "$build_root/signature.status"
awk -v signer="$signing_subkey" -v primary="$primary_key" '$2=="VALIDSIG" && $3==signer && $NF==primary {ok=1} END {exit !ok}' "$build_root/signature.status"

download "$base_url/$sdk_file" "$build_root/$sdk_file"
download "$base_url/feeds.buildinfo" "$build_root/feeds.buildinfo"
(
  cd "$build_root"
  printf '%s  %s\n' "$sdk_hash" "$sdk_file" | sha256sum --strict -c -
  printf '%s  feeds.buildinfo\n' "$feeds_hash" | sha256sum --strict -c -
  awk -v sdk="*$sdk_file" '$2==sdk || $2=="*feeds.buildinfo"' sha256sums > selected.sha256
  [[ "$(wc -l < selected.sha256)" == 2 ]]
  sha256sum --strict -c selected.sha256
)

mkdir "$build_root/sdk"
tar --zstd -xf "$build_root/$sdk_file" --strip-components=1 -C "$build_root/sdk"
sdk="$build_root/sdk"
cp "$build_root/feeds.buildinfo" "$sdk/feeds.conf.default"
mkdir -p "$sdk/package/luci-theme-lumen"
git -C "$repo_root" archive "$source_commit" | tar -xf - -C "$sdk/package/luci-theme-lumen"

(
  cd "$sdk"
  ./scripts/feeds update luci packages
  [[ "$(git -C feeds/luci rev-parse HEAD)" == "$luci_commit" ]]
  ./scripts/feeds install luci-base luci-mod-status luci-theme-bootstrap
  python3 - <<'PY'
from pathlib import Path
import re
p = Path('.config')
config = p.read_text() if p.exists() else ''
settings = {
    'CONFIG_ALL': 'n', 'CONFIG_ALL_NONSHARED': 'n', 'CONFIG_ALL_KMODS': 'n',
    'CONFIG_PACKAGE_luci-theme-lumen': 'm',
    'CONFIG_PACKAGE_luci-i18n-lumen-zh-cn': 'm', 'CONFIG_LUCI_LANG_zh_Hans': 'm',
}
lines = [line for line in config.splitlines() if not any(
    re.match(r'(?:# )?' + re.escape(name) + r'(?:=| is not set)', line)
    for name in settings)]
lines += [f'# {name} is not set' if value == 'n' else f'{name}={value}'
          for name, value in settings.items()]
p.write_text('\n'.join(lines) + '\n')
PY
  make defconfig
  if [[ "$format" == apk ]]; then grep -qx 'CONFIG_USE_APK=y' .config;
  else ! grep -qx 'CONFIG_USE_APK=y' .config; fi
  make -j"${JOBS:-2}" package/luci-theme-lumen/compile V=s SOURCE_DATE_EPOCH="$source_epoch"
)

mkdir -p "$dist" "$tools_dist/host/bin"
mapfile -d '' packages < <(find "$sdk/bin" -type f \( -name "luci-theme-lumen*.$format" -o -name "luci-i18n-lumen-zh-cn*.$format" \) -print0)
[[ "${#packages[@]}" == 2 ]] || { echo 'Expected exactly the theme and Chinese translation packages.' >&2; exit 1; }
cp -- "${packages[@]}" "$dist/"
cp "$build_root/feeds.buildinfo" "$dist/feeds.buildinfo"

python3 - "$dist" "$release" "$format" "$source_commit" "$source_epoch" "$sdk_file" "$sdk_hash" "$feeds_hash" "$luci_commit" "$primary_key" <<'PY'
import json, sys
from pathlib import Path
out, release, fmt, commit, epoch, sdk, sdk_sha, feeds_sha, luci, signer = sys.argv[1:]
info = {
    'openwrt_release': release, 'package_format': fmt, 'source_commit': commit,
    'source_date_epoch': int(epoch), 'sdk_file': sdk, 'sdk_sha256': sdk_sha,
    'feeds_buildinfo_sha256': feeds_sha, 'luci_commit': luci,
    'sdk_manifest_gpg_primary_fingerprint': signer,
    'sdk_manifest_signature_verified': True,
    'signing': 'Packages are not release-signed by this job. Sign and verify before publication.',
    'scope': 'SDK build only; does not claim a router installation or boot test.',
}
Path(out, 'BUILDINFO.json').write_text(json.dumps(info, indent=2) + '\n')
PY
(
  cd "$dist"
  sha256sum -- * > SHA256SUMS.build
)

# A separate verification artifact contains host programs and libraries only.
# It is not a release artifact and never includes SDK signing keys or config.
for tool in apk opkg usign po2lmo; do
  for location in "$sdk/staging_dir/host/bin/$tool" "$sdk/staging_dir/hostpkg/bin/$tool"; do
    if [[ -x "$location" ]]; then
      cp -L "$location" "$tools_dist/host/bin/$tool"
      break
    fi
  done
done
if [[ "$format" == apk ]]; then [[ -x "$tools_dist/host/bin/apk" ]]; fi
[[ -x "$tools_dist/host/bin/usign" ]] || echo 'usign not prebuilt in this SDK; build separately for verification.' >&2
for area in host hostpkg; do
  if [[ -d "$sdk/staging_dir/$area/lib" ]]; then
    mkdir -p "$tools_dist/$area/lib"
    cp -a "$sdk/staging_dir/$area/lib/." "$tools_dist/$area/lib/"
  fi
done
{
  printf 'OpenWrt SDK: %s\nSource: %s\nHost: ' "$release" "$source_commit"
  uname -a
  for tool in "$tools_dist"/host/bin/*; do
    printf '\n%s\n' "$(basename "$tool")"
    file "$tool"
    LD_LIBRARY_PATH="$tools_dist/host/lib:$tools_dist/hostpkg/lib" ldd "$tool" || true
  done
  printf '\nUse a compatible Linux x86_64 host; set LD_LIBRARY_PATH to host/lib:hostpkg/lib in this artifact. No private signing key is included.\n'
} > "$tools_dist/DEPENDENCIES.txt"
tar -czf "$repo_root/validation-tools/openwrt-$release-host-tools.tar.gz" -C "$tools_dist" .
printf 'Built %s packages in %s\n' "$format" "$dist"
