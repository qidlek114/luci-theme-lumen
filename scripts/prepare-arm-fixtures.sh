#!/usr/bin/env bash
# Prepare disposable installation-test inputs. No release keys are used here.
set -euo pipefail
umask 077

fixtures="$(realpath "$1")"
tools_dir="$(realpath "$2")"
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT

for format in new-apk new-ipk; do
  (cd "$fixtures/$format" && sha256sum --check SHA256SUMS.build)
done

tar -xzf "$tools_dir/openwrt-25.12.6-host-tools.tar.gz" -C "$work"
apk="$work/host/bin/apk"
test -x "$apk"
mkdir -p "$fixtures/old" "$fixtures/test-keys"

# SDK artifacts may carry an SDK-local signature. Sign disposable copies with
# an ephemeral key so the target exercises normal signature enforcement. This
# test key is never published as the project's release identity.
openssl ecparam -name prime256v1 -genkey -noout -out "$work/test-private.pem"
openssl pkey -in "$work/test-private.pem" -pubout -out "$fixtures/test-keys/lumen-test.pub"
shopt -s nullglob
packages=("$fixtures/new-apk/"*.apk)
[[ ${#packages[@]} == 3 ]] || { echo 'Expected three APK fixtures.' >&2; exit 1; }
for package in "${packages[@]}"; do
  "$apk" --allow-untrusted adbsign --reset-signatures --sign-key "$work/test-private.pem" "$package"
done
"$apk" --keys-dir "$fixtures/test-keys" verify "${packages[@]}"
(cd "$fixtures/new-apk" && sha256sum -- *.apk > ../test-apk-sha256)

# Preserve the previous project's published trust anchors; verify the previous
# APKs and the signed IPK manifest inside the target environment.
cp docs/keys/lumen-apk.pub docs/keys/lumen-usign.pub "$fixtures/old/"
openssl pkey -pubin -in "$fixtures/old/lumen-apk.pub" -outform DER -out "$work/old-apk.der"
printf '%s  %s\n' 'af8e18e2e8009552e711cff8c28eab28ed636ccb71f0ef01999dcf3f8582f41a' "$work/old-apk.der" | sha256sum -c -
printf '%s  %s\n' '893c2871dbacbbcf61d5f83c7d5e130beedbbd4290b8c4cfcd09dfbc5c421860' "$fixtures/old/lumen-usign.pub" | sha256sum -c -
base='https://github.com/qidlek114/luci-theme-lumen/releases/download/v1.0.1'
for file in \
  luci-theme-lumen-1.0.1-r1.apk luci-i18n-lumen-zh-cn-1.0.1.apk \
  luci-theme-lumen_1.0.1-r1_all.ipk luci-i18n-lumen-zh-cn_1.0.1_all.ipk \
  SHA256SUMS SHA256SUMS.sig; do
  curl --fail --location --retry 3 --proto '=https' --proto-redir '=https' \
    "$base/$file" -o "$fixtures/old/$file"
done
