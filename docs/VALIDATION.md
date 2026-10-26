# v1.0.1 验证记录 / Validation record

记录日期：2026-10-26。以下记录区分源码检查、软件包核对、隔离安装和真机界面验证，不把其中一项的结果扩展成其他项已经通过。

Record date: 2026-10-26. Source checks, package inspection, isolated installation and live UI checks are reported separately. Passing one layer does not establish the others.

## 构建来源 / Build provenance

| 项目 / Item | 记录 / Record |
| --- | --- |
| SDK matrix | [GitHub Actions run 40257353620](https://github.com/qidlek114/luci-theme-lumen/actions/runs/40257353620) — both jobs succeeded |
| Built source | [`8fe1399f`](https://github.com/qidlek114/luci-theme-lumen/commit/8fe1399f) |
| APK target | Official OpenWrt SDK 25.12.6; `noarch` |
| IPK target | Official OpenWrt SDK 24.10.8; `all` |
| Theme package | `luci-theme-lumen`, version `1.0.1-r1` |
| Chinese package | `luci-i18n-lumen-zh-cn`, version `1.0.1` |

后续文档编辑不改变这里记录的软件包构建来源。使用官方 SDK 不表示软件包由 OpenWrt 官方发布或签名；项目公钥与安装验证方法见[安装说明](INSTALL.md)。

Subsequent documentation edits do not change the recorded source used for these packages. Using official SDKs does not make these OpenWrt-published or OpenWrt-signed packages. Project keys and verification steps are documented in the [installation guide](INSTALL.md).

## 已验证范围 / Verified scope

| 检查层级 / Layer | 已得到的结果 / Result | 范围边界 / Limit |
| --- | --- | --- |
| Source and behavior | Source checks and 14 update behavior-test groups passed, including semantic ordering, full intermediate release-note ranges, request bounds, failure states, URL restrictions and text-only rendering. | Behavior tests use controlled fixtures; they do not model every GitHub or browser failure. |
| SDK build | APK and IPK SDK matrix jobs succeeded. | Build success is not installation or boot success. |
| APK source correspondence | Declared package-file hashes for 235 runtime files matched the corresponding source files. | This content check is separate from the installation lifecycle below and is not a repeated binary-build comparison. |
| APK native signatures | Both signed APKs passed `apk verify` using the target root filesystem's native APK tool. An empty trust directory rejected the packages; a temporary copy with one actual payload byte changed was also rejected. | These positive and negative signature checks do not establish the full installation lifecycle. |
| Signed APK preservation | Final signing changed signature data only; package payload, metadata and scripts remained consistent with the CI-built artifacts. | The complete signed archive is not byte-identical to the unsigned archive, and this is not a repeated-build reproducibility result. |
| IPK source correspondence | Extracted bytes for 235 runtime files matched the corresponding source files. | Matching extracted resources does not imply identical package-container bytes across builds. |
| Chinese catalogue | All 168 PO catalogue entries passed verification against the generated translation output. | Translation verification does not establish every third-party page's translation or layout. |
| Responsive update view | Actual helper/view code, theme styles and translations rendered in Chromium at 320, 390 and 1280 px in light and dark modes: no horizontal overflow, clipping or JavaScript errors observed. | Local synthetic release records; no Safari/Firefox engine claim from this run. |
| Range selection | With installed 1.0.0 and sample releases 1.0.1, 1.0.2 and 1.1.0, target 1.1.0 displayed all three sections and target 1.0.2 displayed two. Opening the view sent no GitHub request; one manual check made one fixture-intercepted request; target changes made none. | Sample history illustrates behavior, not real published versions. |

### IPK：OpenWrt 24.10.8 隔离环境

以下步骤已经完成：

- 经过签名校验的安装及主题启用。
- 从 `1.0.0-r1` 旧版本测试包升级到 `1.0.1-r1`，保留外观配置和所选主题。这里的旧包是升级测试夹具，不是声称 v1.0.0 曾发布该 IPK。
- Lumen 为当前主题时卸载，回退 Bootstrap；Lumen 非当前主题时卸载，保留既有主题选择。
- 网络、防火墙和 DHCP 配置文件的存在状态及摘要在测试前后保持一致。
- 测试挂载和测试进程完成清理，无对应遗留。

The isolated OpenWrt 24.10.8 IPK test passed signature-checked installation and activation, an upgrade from a `1.0.0-r1` fixture to `1.0.1-r1` preserving appearance and selection, and active/inactive theme removal behavior. The older fixture is not a claim that an IPK was published for v1.0.0. Recorded network, firewall and DHCP configuration file presence and hashes stayed unchanged. Test mounts and processes were cleaned up.

隔离环境未做完整系统启动或重启，也没有验证真实转发、DNS、防泄漏或代理流量。配置文件没有变化是文件层证据，不应扩大成整台路由器网络行为已经验收。

The isolated test did not perform a full boot/reboot or exercise real forwarding, DNS, leak prevention or proxy traffic. Unchanged configuration files are file-level evidence, not a complete router-network acceptance test.

### APK：OpenWrt 25.12.6 隔离环境

已完成最终签名包的安装、从 `1.0.0-r1` 测试包升级到 `1.0.1-r1` 及卸载检查，UCI 配置得到保留。验证日志记录了生命周期完成，以及网络、防火墙、DHCP 配置文件内容和原先不存在状态均保持一致。

The isolated OpenWrt 25.12.6 APK test completed signed installation, upgrade from a `1.0.0-r1` fixture to `1.0.1-r1`, and removal, preserving UCI configuration. Its validation log recorded lifecycle completion and unchanged network, firewall and DHCP configuration file contents and original absence states.

这里使用目标根文件系统中的原生 APK 工具；没有启动完整路由器系统。上述 APK 安装结果与前面的原生验签、空信任目录及真实 payload 字节篡改对照是不同的检查步骤，不等同于真实路由器整包安装或重启验收。

This used the native APK tool in the target root filesystem without booting a complete router system. The lifecycle result is separate from the native-signature, empty-trust-directory and actual payload-byte tampering checks above. It does not establish a full package installation or reboot on the live router.

### 真机：OpenWrt 25.12.6 更新页

只部署了与更新页有关的 5 个界面文件，并在真实浏览器确认中文显示和用户触发的 GitHub 查询正常。过程使用路由器本地的 30 秒回滚保护；变更提交完成后守护退出。代理保持原状态。

Only five update-related UI files were deployed on a live OpenWrt 25.12.6 device. A real browser confirmed the Chinese interface and a user-triggered GitHub query. Deployment used a router-local 30-second rollback guard, which exited after the change was committed. The proxy remained unchanged.

这不是通过包管理器安装完整发布 APK 的测试，也不证明所有 GitHub 发布、所有浏览器或所有网络路径均可用。没有为此执行完整系统启动或重启。

This was not a package-manager installation of the complete published APK. It does not establish access to every release, every browser or every network path. No full system boot or reboot was performed for this check.

## 仍未完成 / Not yet established

- 在真实路由器上通过包管理器安装完整发布包。
- 完整系统启动或重启后的行为验收。
- 未列出的固件、厂商 LuCI 修改、全部第三方插件和浏览器组合。
- 相同输入重复构建得到完全相同包字节的证明。

Full release-package installation on a router, boot/reboot behavior, broader firmware/plugin/browser coverage and bit-for-bit build reproducibility are not established by the checks above.

## 时间戳与可复现性 / Timestamps and reproducibility

本次 IPK control 中的 `SourceDateEpoch` 是 SDK 提供的 `1784877710`。`BUILDINFO` 中的 `source_date_epoch` 是为源码提交请求的 `1792980315`。两者描述不同来源的时间值，不应把它们写成“已证明所有包内时间戳都使用源码提交时间”。

The IPK control metadata contains the SDK-provided `SourceDateEpoch` value `1784877710`. `BUILDINFO` records `source_date_epoch` as `1792980315`, the requested source-commit timestamp. These are different provenance values; they do not show that every package timestamp used the source commit's time.

源码对应检查、包摘要以及签名验证各有用途，但都不能替代重复构建比较。本项目在本记录中不声明二进制位级可复现。

Source correspondence, package checksums and signatures serve different purposes and do not replace a repeated-build comparison. This record makes no bit-reproducibility claim.
