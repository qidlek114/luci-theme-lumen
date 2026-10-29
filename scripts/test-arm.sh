#!/usr/bin/env bash
# Run installation checks in an offline, disposable OpenWrt rootfs.
set -euo pipefail
release="$1"
arch="$2"
fixtures="$(realpath "$3")"
case "$release/$arch" in
  25.12.6/armv8) hash='8fcb00eb886d9add37e111a4ec43d47d57aa74742281c6a8f348a7a7ec37edb7'; format=apk; platform=linux/arm64; target=armsr; subtype=armv8 ;;
  25.12.6/armv7) hash='f0e25d1b7abd6d317e416aed915820d85b8f1e2c457c1b2c38522e91c1e31aca'; format=apk; platform=linux/arm/v7; target=armsr; subtype=armv7 ;;
  24.10.8/armv8) hash='eab7e31f508ff0af1d47afc779eb08f237bb0f1cec5014592afe4893a06318a3'; format=ipk; platform=linux/arm64; target=armsr; subtype=armv8 ;;
  24.10.8/armv7) hash='8ea759dd925d530b2cc293e39658e92f9a4703635dcb79af3b3352f9cd0adf49'; format=ipk; platform=linux/arm/v7; target=armsr; subtype=armv7 ;;
  25.12.6/x86_64) hash='55e52bb34de582a1ebe56bd50f94ff54ac7c77f5bca9cae807656d1930456da4'; format=apk; platform=linux/amd64; target=x86; subtype=64 ;;
  24.10.8/x86_64) hash='6c94190246a54088e3984fc0c4cbbb518972abb2b10a28e30a0c41554eea8b9d'; format=ipk; platform=linux/amd64; target=x86; subtype=64 ;;
  *) echo 'Unsupported OpenWrt release / architecture.' >&2; exit 2 ;;
esac

work="$(mktemp -d)"
image="lumen-install-test:${release}-${arch}"
prepared="lumen-install-test:${release}-${arch}-deps"
container=''
trap '[[ -z "$container" ]] || docker rm -f "$container" >/dev/null 2>&1 || true; docker image rm "$prepared" "$image" >/dev/null 2>&1 || true; rm -rf -- "$work"' EXIT
base="https://downloads.openwrt.org/releases/$release/targets/$target/$subtype"
rootfs="openwrt-${release}-${target}-${subtype}-rootfs.tar.gz"
mkdir -m 700 "$work/gnupg"
download() { curl --fail --location --retry 3 --proto '=https' --tlsv1.2 "$1" -o "$2"; }
download 'https://git.openwrt.org/keyring/plain/gpg/0x1D53D1877742E911.asc' "$work/openwrt-key.asc"
fingerprint="$(gpg --homedir "$work/gnupg" --batch --show-keys --with-colons "$work/openwrt-key.asc" | awk -F: '$1=="fpr" {print $10; exit}')"
[[ "$fingerprint" == '8A8BC12F46B836C0F9CDB36F1D53D1877742E911' ]]
gpg --homedir "$work/gnupg" --batch --import "$work/openwrt-key.asc"
download "$base/sha256sums" "$work/sha256sums"
download "$base/sha256sums.asc" "$work/sha256sums.asc"
gpg --homedir "$work/gnupg" --batch --status-fd 1 --verify "$work/sha256sums.asc" "$work/sha256sums" > "$work/signature.status"
awk '$2=="VALIDSIG" && $3=="92C561DE55AE6552F3C736B82B0151090606D1D9" && $NF=="8A8BC12F46B836C0F9CDB36F1D53D1877742E911" {ok=1} END {exit !ok}' "$work/signature.status"
download "$base/$rootfs" "$work/$rootfs"
(
  cd "$work"
  printf '%s  %s\n' "$hash" "$rootfs" | sha256sum --strict -c -
  awk -v name="*$rootfs" '$2==name {print; n++} END {exit n!=1}' sha256sums > rootfs.sha256
  sha256sum --strict -c rootfs.sha256
)

docker import --platform "$platform" "$work/$rootfs" "$image" >/dev/null
# The stock images include usign, flock and rpcd-mod-ucode but not curl.
# Install the normal, officially signed runtime dependency using the feeds
# shipped in the authenticated rootfs; all theme tests below remain offline.
if [[ "$format" == apk ]]; then
  prepare='apk update && apk add curl'
else
  prepare='opkg update && opkg install curl'
fi
container="$(docker create --platform "$platform" --memory 128m --memory-swap 128m "$image" /bin/sh -c "$prepare")"
docker start -a "$container"
docker commit "$container" "$prepared" >/dev/null
docker rm "$container" >/dev/null
container=''
docker run --rm --platform "$platform" --network none --memory 128m --memory-swap 128m \
  --mount "type=bind,src=$fixtures,dst=/fixtures,readonly" \
  --mount "type=bind,src=$(realpath scripts/test-arm-container.sh),dst=/test-arm.sh,readonly" \
  "$prepared" /bin/sh /test-arm.sh "$format" "$arch"
