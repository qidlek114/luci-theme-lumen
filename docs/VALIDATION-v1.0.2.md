# v1.0.2 验证记录 / Validation record

## 构建与大小 / Build provenance and size

- APK 使用 OpenWrt 25.12.6 SDK，IPK 使用 OpenWrt 24.10.8 SDK。SDK 清单的 OpenWrt 签名和下载摘要均已检查；构建元数据见 Release 中的两个 `BUILDINFO` 文件。主题资源分别标记为 `noarch` 和 `all`，并不保证适用于所有 LuCI 或固件版本。
- 软件包源码为 `b0ab816a754f71d0cdd64f3fe6aa4d14e65368eb`。构建后更新了验证脚本和文档，测试运行检查了 `Makefile`、`htdocs`、`root`、`po` 和 `licenses` 与该提交一致。[SDK 构建记录](https://github.com/qidlek114/luci-theme-lumen/actions/runs/40841413747)中的两个构建任务及测试素材准备任务成功；该次运行的部分早期 IPK 安装测试失败，随后修正了测试环境并重新验证。
- `BUILDINFO` 描述的是 SDK 产物生成时的状态，其中的“未发布签名”指构建步骤；发布附件后来使用本项目的新密钥在本机签名，见下方验证。
- 签名后的主题主体 APK 为 78,986 字节，IPK 为 78,819 字节。v1.0.1 主题 APK 为 6,678,871 字节；新版 APK 主体下载体积减少约 98.8%。可选字体 APK 为 6,599,642 字节，IPK 为 6,606,636 字节；安装字体仍需要额外下载和存储空间。中文包需另装。

## 签名与安装 / Signatures and installation

[最终签名包的隔离验证](https://github.com/qidlek114/luci-theme-lumen/actions/runs/40855727477)使用实际发布文件：

| OpenWrt / 包格式 | ARMv7 | ARMv8 | x86_64 |
| --- | --- | --- | --- |
| 25.12.6 / APK | 通过，模拟执行 | 通过，原生 ARM64 运行器 | 通过，原生 x86_64 运行器 |
| 24.10.8 / IPK | 通过，模拟执行 | 通过，原生 ARM64 运行器 | 通过，原生 x86_64 运行器 |

测试在离线的 OpenWrt rootfs 容器中执行，内存上限 128 MiB。每组检查旧版安装、升级并保留主题／LuCI 配置、可选字体安装和移除、卸载回退、重新安装和模板编译；容器内合成的网络、防火墙及 DHCP 配置前后保持一致。测试并未启动真实路由器，也不代表实际路由或转发正常。

APK 使用新公钥进行原生验签，旧公钥和空信任目录均不能验证新版。IPK 使用新 usign 公钥验证 `SHA256SUMS.sig`，再检查发布包摘要；旧公钥不能验证新版清单。测试中的 IPK 与最终发布 IPK 逐字节一致。所有附件摘要在上传时再次与 GitHub 返回值核对。本机还检查了 APK 内容块未因签名而改变，并确认篡改包被拒绝。

旧私钥不可用，因此密钥更换没有旧密钥交叉签名。首次信任新版公钥前，请通过独立可信渠道核对 [安装与换钥说明](INSTALL-v1.0.2.md)中的完整摘要。

## 界面与限制 / UI and limits

源码检查覆盖字体拆包、后台标签页暂停请求、连接数上限缓存和图表重绘限制；这不是实际 CPU、内存或功耗的基准测试。主路由的网络唤醒页面已单独应用响应式样式修复并在真实浏览器检查；主路由并未安装完整 v1.0.2 包，未进行完整固件启动／重启验收。页面显示目标不代表曾发送魔术包或成功唤醒设备。

The final package lifecycle was checked in disposable OpenWrt rootfs containers on the architectures above. ARMv7 ran under emulation; these checks do not establish physical-device boot, routing, vendor-firmware or every browser/plugin compatibility. The main router received only the scoped Wake-on-LAN layout fix, not the complete v1.0.2 installation. No CPU, memory or power benchmark is claimed.
