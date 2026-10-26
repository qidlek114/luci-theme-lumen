# 安装与签名验证 / Installation and signature verification

**v1.0.1 的两个 SDK 构建，以及 APK／IPK 的隔离签名校验安装、升级和卸载检查已通过。** 真机仅验证了更新页界面文件部署和手动查询，没有执行完整发布包安装；隔离环境和真机均未执行完整启动或重启验收。详见[验证记录](VALIDATION.md)。以对应 [Release](https://github.com/qidlek114/luci-theme-lumen/releases) 的实际资产与验证范围为准；缺少所需包、公钥或签名时不要继续。

**Both v1.0.1 SDK builds and isolated signature-checked APK/IPK installation, upgrade and removal checks passed.** The live-device check covered only update-page UI files and a manual query, not full release-package installation. Neither the isolated environments nor the router underwent a full boot/reboot test. See the [validation record](VALIDATION.md) and the corresponding Release assets. Stop if a required package, key or signature is unavailable.

## 选择包 / Choose a package

| 目标 / Target | 格式 / Format | 架构 / Architecture | 运行环境 / Runtime |
| --- | --- | --- | --- |
| OpenWrt 25.12.6 SDK target | APK | `noarch` | ucode LuCI |
| OpenWrt 24.10.8 SDK target | IPK | `all` | ucode LuCI |

这两个构建目标不等于所有同系列固件均已验证。架构无关也不等于任意固件可用；旧 Lua LuCI 不适用。不要混装包格式或更换系统包管理器。主题依赖 `luci-base`、`luci-mod-status`、`luci-theme-bootstrap`。中文包为 `luci-i18n-lumen-zh-cn`，可选安装。源码 ZIP／tar.gz 不能作为软件包安装。OpenWrt 从 25.12 起采用 APK。[OpenWrt APK 文档](https://openwrt.org/docs/guide-user/additional-software/apk)

Architecture-independent does not mean compatible with every firmware. Use the format already supported by your device and matching ucode LuCI; older Lua LuCI is unsupported. The theme depends on `luci-base`, `luci-mod-status` and `luci-theme-bootstrap`. `luci-i18n-lumen-zh-cn` is optional. Source ZIP/tar.gz archives are not installable packages.

保留可用原主题，记录当前主题路径，并检查可用空间。字体约 6.53 MB（未压缩），另需主题资源、依赖与升级临时空间。

Keep a working fallback theme, record its path and check free space. Fonts alone occupy about 6.53 MB uncompressed, plus theme resources, dependencies and upgrade space.

```sh
cat /etc/openwrt_release
df -h /overlay /tmp
uci -q get luci.main.mediaurlbase
```

## 信任与验证 / Trust and verification

这是使用官方 SDK 构建的第三方主题包。签名属于 Lumen 项目，不是 OpenWrt 官方签名。首次信任公钥前，通过已信任渠道核对其完整摘要；从同一发布页面同时下载公钥和摘要，不能抵御该页面或账号整体遭替换。

These are third-party packages built with official SDKs, signed by the Lumen project rather than OpenWrt. Verify a new public key through an already trusted channel. Downloading a key and its expected hash from the same compromised page would not establish an independent identity check.

- **APK：**核对 P-256 公钥，再验证包的原生签名。公钥为 [`lumen-apk.pub`](keys/lumen-apk.pub)，**DER 编码 SHA-256** 为 `af8e18e2e8009552e711cff8c28eab28ed636ccb71f0ef01999dcf3f8582f41a`。
- **IPK：**公钥为 [`lumen-usign.pub`](keys/lumen-usign.pub)，**完整文件 SHA-256** 为 `893c2871dbacbbcf61d5f83c7d5e130beedbbd4290b8c4cfcd09dfbc5c421860`，key ID 为 `feab778b1224810b`。核对完整摘要后验证 `SHA256SUMS.sig`，最后核对包摘要。`usign -F` 只是 key ID，不是完整公钥哈希；不能单凭这个短标识建立信任。
- **SHA-256 单独不是发布者身份认证。** APK 的身份验证来自受信任公钥验证的包签名；IPK 的身份验证链是受信任公钥 → 签名摘要清单 → 包内容。
- 保持 HTTPS 证书和包签名校验。证书、签名、依赖或版本错误应先解决，不要通过关闭校验或强制忽略依赖继续。

For APKs, pin the P-256 public key's DER SHA-256 shown above and verify the native package signature. For IPKs, pin the full usign public-key file hash from a trusted source, verify the signed checksum manifest, then verify the packages. `usign -F` is only a key ID. A checksum alone does not authenticate the publisher. Keep TLS and signature verification enabled. [usign implementation and usage](https://lxr.openwrt.org/source/usign/main.c)

## APK：下载并验证 / Download and verify APKs

需要 `curl`、`openssl`、`sha256sum` 和支持 `verify` 的 APK。缺失工具仅从设备原有、与固件匹配且签名验证正常的软件源安装。以下在路由器已有管理终端执行；按提示输入 Release 中两个 APK 的精确文件名，示例同时处理主题和中文包。

Use `curl`, `openssl`, `sha256sum` and an APK version supporting `verify`. Obtain missing tools only from the device's existing signed firmware-matched repositories. In the router's existing management shell, enter the exact theme and Chinese APK asset names from the Release. This example verifies both packages.

```sh
set -eu
printf 'Theme APK filename from v1.0.1 Release: '
read -r THEME_APK
printf 'Chinese APK filename from v1.0.1 Release: '
read -r ZH_APK
printf '%s\n' "$THEME_APK" | grep -Eq '^luci-theme-lumen[-_][A-Za-z0-9.+~_-]+\.apk$'
printf '%s\n' "$ZH_APK" | grep -Eq '^luci-i18n-lumen-zh-cn[-_][A-Za-z0-9.+~_-]+\.apk$'

task_dir=$(mktemp -d /tmp/lumen-apk.XXXXXX)
cd "$task_dir"
base='https://github.com/qidlek114/luci-theme-lumen/releases/download/v1.0.1'
for file in "$THEME_APK" "$ZH_APK" SHA256SUMS; do
    curl -fL --proto '=https' --proto-redir '=https' -o "$file" "$base/$file"
done
curl -fL --proto '=https' --proto-redir '=https' -o lumen-apk.pub \
    'https://raw.githubusercontent.com/qidlek114/luci-theme-lumen/v1.0.1/docs/keys/lumen-apk.pub'

openssl pkey -pubin -in lumen-apk.pub -outform DER -out lumen-apk.der
printf '%s  %s\n' \
    'af8e18e2e8009552e711cff8c28eab28ed636ccb71f0ef01999dcf3f8582f41a' \
    'lumen-apk.der' | sha256sum -c -

awk -v a="$THEME_APK" -v b="$ZH_APK" '
    $2 == a { na++; print }
    $2 == b { nb++; print }
    END { if (na != 1 || nb != 1) exit 1 }
' SHA256SUMS > selected.sha256
sha256sum -c selected.sha256

# The native signature authenticates the APK; the plain manifest alone does not.
mkdir trusted-apk-keys
cp lumen-apk.pub trusted-apk-keys/lumen-apk.pub
apk --keys-dir "$task_dir/trusted-apk-keys" verify "./$THEME_APK" "./$ZH_APK"
```

只有以上步骤全部成功后，才将项目公钥加入 APK 信任目录。此举表示以后也信任这把项目密钥；已有不同文件时下列命令会停止，不覆盖。

Only after verification succeeds, register the project public key below. This also trusts future signatures from that key. A different existing key stops the command rather than being overwritten.

```sh
mkdir -p /etc/apk/keys
if [ -e /etc/apk/keys/lumen-apk.pub ]; then
    cmp -s lumen-apk.pub /etc/apk/keys/lumen-apk.pub
else
    cp lumen-apk.pub /etc/apk/keys/lumen-apk.pub
    chmod 644 /etc/apk/keys/lumen-apk.pub
fi
```

`apk verify` 验证包完整性与密码学签名，`--keys-dir` 将本次验证限制为指定公钥目录。安装时正常的 APK 签名验证仍应保持启用。[APK verify 手册](https://raw.githubusercontent.com/alpinelinux/apk-tools/master/doc/apk-verify.8.scd)、[APK 信任目录](https://raw.githubusercontent.com/alpinelinux/apk-tools/master/doc/apk.8.scd)

## IPK：下载并验证 / Download and verify IPKs

只有 Release 同时提供两个 IPK、`SHA256SUMS`、`SHA256SUMS.sig` 和 `lumen-usign.pub` 时，才执行此流程。下列命令核对上面的固定公钥摘要。不要自行生成一个公钥或将刚下载文件算出的摘要当作预期值。

Proceed only when the Release provides the IPKs, `SHA256SUMS`, `SHA256SUMS.sig` and `lumen-usign.pub`. The commands below pin the full public-key file SHA-256 shown above; verify that fingerprint through an already trusted channel. Do not generate a replacement key or use the downloaded file's own calculated hash as the expected value.

需要 `curl`、`usign` 和 `sha256sum`。此处不新增 opkg 软件源，不把公钥放进 `/etc/opkg/keys`。本地 IPK 安装不会替你验证项目独立提供的 `SHA256SUMS.sig`，因此显式验签不可省略。

Use `curl`, `usign` and `sha256sum`. This procedure does not add an opkg feed or global feed key. Local IPK installation does not automatically verify this project's detached manifest signature, so the explicit verification step is required.

```sh
set -eu
printf 'Theme IPK filename from v1.0.1 Release: '
read -r THEME_IPK
printf 'Chinese IPK filename from v1.0.1 Release: '
read -r ZH_IPK
EXPECTED_KEY_SHA256='893c2871dbacbbcf61d5f83c7d5e130beedbbd4290b8c4cfcd09dfbc5c421860'
printf '%s\n' "$THEME_IPK" | grep -Eq '^luci-theme-lumen[-_][A-Za-z0-9.+~_-]+\.ipk$'
printf '%s\n' "$ZH_IPK" | grep -Eq '^luci-i18n-lumen-zh-cn[-_][A-Za-z0-9.+~_-]+\.ipk$'
printf '%s\n' "$EXPECTED_KEY_SHA256" | grep -Eq '^[0-9a-fA-F]{64}$'

task_dir=$(mktemp -d /tmp/lumen-ipk.XXXXXX)
cd "$task_dir"
base='https://github.com/qidlek114/luci-theme-lumen/releases/download/v1.0.1'
for file in "$THEME_IPK" "$ZH_IPK" SHA256SUMS SHA256SUMS.sig lumen-usign.pub; do
    curl -fL --proto '=https' --proto-redir '=https' -o "$file" "$base/$file"
done
printf '%s  %s\n' "$EXPECTED_KEY_SHA256" 'lumen-usign.pub' | sha256sum -c -
actual_key_id=$(usign -F -p lumen-usign.pub)
[ "$actual_key_id" = 'feab778b1224810b' ]
usign -V -p lumen-usign.pub -m SHA256SUMS -x SHA256SUMS.sig
awk -v a="$THEME_IPK" -v b="$ZH_IPK" '
    $2 == a { na++; print }
    $2 == b { nb++; print }
    END { if (na != 1 || nb != 1) exit 1 }
' SHA256SUMS > selected.sha256
sha256sum -c selected.sha256
```

opkg 仓库索引签名与以上“公钥 → 签名清单 → IPK”验证链应区分；不要只看到包的 SHA-256 匹配就宣称来源可信。[OpenWrt 签名说明](https://openwrt.org/docs/guide-user/security/release_signatures)

## 手动安装、启用与更新 / Install, activate and update manually

从主题更新页下载到电脑的包，应在完成以上签名及内容验证后，进入 LuCI **系统 → 软件包** 上传并确认安装；中文包随后安装。不要把路由器 `/tmp` 中的文件误当成电脑上的同名文件，实际安装的必须是已经验证的同一份内容。

For files downloaded to your computer, verify the signatures and contents before uploading them through **System → Software** and confirming installation, followed by the optional Chinese package. A same-named file is not proof of identical content; install the files you actually verified.

如果是在路由器终端完成前面的下载和验证，也可以明确选择在同一终端手动安装这些已验证文件。下面两组只执行与本机包管理器匹配的一组，不是网页自动升级：

If you downloaded and verified files in the router shell above, you may instead deliberately install those same files there. Run only the group matching the device's existing package manager. These are manual commands, not automatic web updates.

```sh
# APK: run in the same shell and verification directory.
apk update
apk add "./$THEME_APK" "./$ZH_APK"
```

```sh
# IPK: run in the same shell and verification directory.
opkg update
opkg install "./$THEME_IPK" "./$ZH_IPK"
```

安装会登记主题，不自动启用。正常 LuCI 生命周期可能清理缓存并重载 `rpcd`，管理页面可能需重新登录；不重启网络、防火墙或代理，也不修改 DNS 或分流。依赖解析可能补装缺少的 LuCI 组件，请阅读包管理器结果。[LuCI 安装生命周期](https://raw.githubusercontent.com/openwrt/luci/openwrt-25.12/luci.mk)

Installation registers but does not select Lumen. Standard LuCI handling may clear caches and reload `rpcd`; log in again if needed. It does not restart networking, the firewall or proxies, or change DNS or routing policy. Review any dependency installation proposed by the package manager.

在 **系统 → 系统 → 语言和界面** 手动选择 **Lumen**。**Lumen → 检查更新** 只在点击后检查公开 GitHub 发布，按数字版本顺序展示当前版之后到目标版的所有正式版说明；检查失败或历史不完整会明确提示，不能据此认定没有更新。下载链接仅指向本仓库发布资产，之后仍由用户验证并确认安装。

Select **Lumen** manually under **System → System → Language and Style**. **Lumen → Updates** checks public GitHub releases only when requested and includes all stable release notes after the installed version through the target. Failed or incomplete checks are explicitly reported, not treated as no updates. Downloads remain limited to this repository's Release assets, with verification and installation confirmation left to you.

## 回退与卸载 / Revert and uninstall

优先通过 LuCI 切回先前记录且仍安装的原主题。若页面不可用，可通过现有管理连接选择依赖中保留的 Bootstrap；这里只提交 LuCI 界面配置：

Prefer selecting the previous, still-installed theme in LuCI. If the page is unavailable, use the existing management connection to select Bootstrap, retained as a dependency. Only LuCI appearance configuration is committed:

```sh
uci set luci.main.mediaurlbase='/luci-static/bootstrap'
uci commit luci
```

刷新并确认原主题可用，再按包格式执行一组卸载命令；以下假设中文包也已安装：

Refresh and confirm the fallback works before running the matching removal command. These examples assume the Chinese package is installed too:

```sh
# APK
apk del luci-i18n-lumen-zh-cn luci-theme-lumen
```

```sh
# IPK
opkg remove luci-i18n-lumen-zh-cn luci-theme-lumen
```

不要删除 LuCI 基础包或回退主题。配置文件由包管理器的配置保留机制处理；不要为了卸载主题清理网络或代理配置。项目公钥属于单独的信任管理，确认不再被其他项目包使用后才考虑移除。

Keep LuCI base packages and the fallback theme. Let the package manager handle configuration-file preservation; theme removal does not require network or proxy cleanup. Removing a signing key is a separate trust decision and may affect other packages signed by it.
