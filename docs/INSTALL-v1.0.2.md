# v1.0.2 安装与签名验证 / Installation and signature verification

v1.0.2 面向 ucode LuCI：APK 使用 OpenWrt 25.12.6 SDK，IPK 使用 24.10.8 SDK。主题资源与处理器架构无关，但包格式、LuCI API 和依赖仍须匹配设备。请保留可用的回退主题，并检查 `/overlay` 和 `/tmp` 的可用空间。主题依赖 `luci-base`、`luci-mod-status`、`luci-theme-bootstrap`。字体包可选；不安装时使用浏览设备的系统字体。

The SDK targets are OpenWrt 25.12.6 (APK) and 24.10.8 (IPK), with ucode LuCI. Architecture-independent assets still require a matching package manager, LuCI API and dependencies. Keep a working fallback theme and check free space. Fonts are optional; without the font package, the browsing device uses its system fonts.

## 公钥更换 / Key rotation

**v1.0.2 更换了项目签名密钥。** v1.0.1 的公钥与签名保持不变；旧公钥无法验证新版。原私钥不可用，因此本次更换没有旧密钥的交叉签名，不能仅凭新发布页证明与旧密钥的连续性。首次信任前，请通过已经信任的独立渠道核对以下完整摘要。不要关闭 TLS 或软件包签名验证。

**The release signing keys changed in v1.0.2.** The v1.0.1 keys and signatures remain unchanged, but cannot authenticate this release. The old private keys were unavailable, so this rotation is not cross-signed and the new release page alone cannot prove continuity with the old keys. Verify the complete fingerprints through an independently trusted channel before trusting the new keys. Keep TLS and package-signature verification enabled.

- APK P-256 公钥的 DER SHA-256 / APK P-256 public key DER SHA-256: `e3d1ad71726efe0d80e38e1cbffba7f328b2e49afac068a7f55d295dcaa80c75`
- usign 公钥完整文件 SHA-256 / usign public-key file SHA-256: `fc4b502acfae4dfec67c842bc5aeeedac729736a6e1b3eefe23108159faaab8d`
- usign key ID: `1ece729a92805575`。短 key ID 不能代替完整摘要 / A short key ID is not a substitute for the full fingerprint.

旧版安装说明和旧公钥见 [v1.0.1 安装说明](INSTALL.md)。新版公钥副本保存在 [`keys/v1.0.2/`](keys/v1.0.2/) 及对应 Release 中。项目签名不代表 OpenWrt 官方签名。SHA-256 单独不能证明发布者身份。

## APK：下载、验证和安装 / Download, verify and install APKs

在路由器已有管理终端中执行。需要 `curl`、`openssl`、`sha256sum` 和支持 `verify` 的 `apk`；缺失工具应来自与固件匹配且可信的原有软件源。以下先下载主体和中文包，字体包在后面单独处理。

Run in the router's existing management shell. The example downloads the core and Chinese packages first; the optional fonts are handled separately below.

```sh
set -eu
task_dir=$(mktemp -d /tmp/lumen-v1.0.2-apk.XXXXXX)
cd "$task_dir"
base='https://github.com/qidlek114/luci-theme-lumen/releases/download/v1.0.2'
THEME_APK='luci-theme-lumen-1.0.2-r1.apk'
ZH_APK='luci-i18n-lumen-zh-cn-1.0.2.apk'
FONT_APK='luci-theme-lumen-fonts-1.0.2-r1.apk'
for file in "$THEME_APK" "$ZH_APK" lumen-apk.pub; do
    curl -fL --proto '=https' --proto-redir '=https' -o "$file" "$base/$file"
done
openssl pkey -pubin -in lumen-apk.pub -outform DER -out lumen-apk.der
printf '%s  %s\n' \
    'e3d1ad71726efe0d80e38e1cbffba7f328b2e49afac068a7f55d295dcaa80c75' \
    'lumen-apk.der' | sha256sum -c -
mkdir trusted-apk-keys
cp lumen-apk.pub trusted-apk-keys/lumen-apk.pub
apk --keys-dir "$task_dir/trusted-apk-keys" verify "./$THEME_APK" "./$ZH_APK"
```

仅在核对公钥并完成上述验证后，才决定是否在 APK 信任目录中加入新版公钥。使用独立文件名以保留可能已安装的旧公钥；遇到同名不同内容时停止，不覆盖。

Only after verifying the fingerprint and packages, decide whether to trust the new key for future packages. The versioned filename preserves any previously installed key; a conflicting file stops the command.

```sh
mkdir -p /etc/apk/keys
if [ -e /etc/apk/keys/lumen-apk-v1.0.2.pub ]; then
    cmp -s lumen-apk.pub /etc/apk/keys/lumen-apk-v1.0.2.pub
else
    cp lumen-apk.pub /etc/apk/keys/lumen-apk-v1.0.2.pub
    chmod 644 /etc/apk/keys/lumen-apk-v1.0.2.pub
fi
apk add "./$THEME_APK" "./$ZH_APK"
```

如需自带字体，在同一终端和目录中执行 / For optional self-hosted fonts, in the same shell and directory:

```sh
curl -fL --proto '=https' --proto-redir '=https' -o "$FONT_APK" "$base/$FONT_APK"
apk --keys-dir "$task_dir/trusted-apk-keys" verify "./$FONT_APK"
apk add "./$FONT_APK"
```

## IPK：下载、验证和安装 / Download, verify and install IPKs

本地 `opkg install` 不会自动验证项目提供的独立清单签名。先核对完整公钥摘要，再验证 `SHA256SUMS.sig`，最后核对将要安装的文件；不要把公钥加入系统软件源信任目录。

Local `opkg install` does not verify the project's detached manifest signature. Pin the full key fingerprint, verify the manifest, then check the exact files being installed. This procedure does not add a system feed key.

```sh
set -eu
task_dir=$(mktemp -d /tmp/lumen-v1.0.2-ipk.XXXXXX)
cd "$task_dir"
base='https://github.com/qidlek114/luci-theme-lumen/releases/download/v1.0.2'
THEME_IPK='luci-theme-lumen_1.0.2-r1_all.ipk'
ZH_IPK='luci-i18n-lumen-zh-cn_1.0.2_all.ipk'
FONT_IPK='luci-theme-lumen-fonts_1.0.2-r1_all.ipk'
for file in "$THEME_IPK" "$ZH_IPK" SHA256SUMS SHA256SUMS.sig lumen-usign.pub; do
    curl -fL --proto '=https' --proto-redir '=https' -o "$file" "$base/$file"
done
printf '%s  %s\n' \
    'fc4b502acfae4dfec67c842bc5aeeedac729736a6e1b3eefe23108159faaab8d' \
    'lumen-usign.pub' | sha256sum -c -
[ "$(usign -F -p lumen-usign.pub)" = '1ece729a92805575' ]
usign -V -p lumen-usign.pub -m SHA256SUMS -x SHA256SUMS.sig
awk -v a="$THEME_IPK" -v b="$ZH_IPK" '
    $2 == a { na++; print }
    $2 == b { nb++; print }
    END { if (na != 1 || nb != 1) exit 1 }
' SHA256SUMS > selected.sha256
sha256sum -c selected.sha256
opkg install "./$THEME_IPK" "./$ZH_IPK"
```

如需自带字体，在同一终端和目录中执行 / For optional fonts, in the same shell and directory:

```sh
curl -fL --proto '=https' --proto-redir '=https' -o "$FONT_IPK" "$base/$FONT_IPK"
awk -v a="$FONT_IPK" '$2 == a { n++; print } END { if (n != 1) exit 1 }' SHA256SUMS > font.sha256
sha256sum -c font.sha256
opkg install "./$FONT_IPK"
```

安装完成后，在 LuCI **系统 → 系统 → 语言和界面** 手动选择 Lumen。标准 LuCI 包处理可能清理界面缓存并重载 `rpcd`；它不需要更改网络、DNS 或代理配置。隔离安装测试不等于实机启动或重启验收。

After installation, select Lumen manually under **System → System → Language and Style**. Normal LuCI package handling may clear UI caches and reload `rpcd`; no network, DNS or proxy configuration change is required. Isolated package tests do not establish physical-device boot or reboot behavior.
