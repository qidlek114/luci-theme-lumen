<p align="center"><img src="docs/branding/logo.svg" width="72" height="72" alt="Lumen 彩色路由器图标"></p>

# Lumen for LuCI

[![源码检查](https://github.com/qidlek114/luci-theme-lumen/actions/workflows/validate.yml/badge.svg)](https://github.com/qidlek114/luci-theme-lumen/actions/workflows/validate.yml)

一个面向现代 OpenWrt LuCI 的轻量界面主题：清晰的侧栏、明暗配色、实时仪表盘，以及适合窄窗口和手机的布局。

[English](README.en.md) · [Releases](https://github.com/qidlek114/luci-theme-lumen/releases) · [问题反馈](https://github.com/qidlek114/luci-theme-lumen/issues) · [参与贡献](CONTRIBUTING.md)

![Lumen 深色桌面界面，使用演示数据](docs/screenshots/desktop-dark.png)

## 功能

- 深色、浅色或跟随系统；提供两种外观风格。
- 独立的 Lumen 仪表盘、负载／带宽／连接图表和外观设置。
- 路由器名称、硬件型号、接口和统计来自运行环境，支持单独设置界面显示名称。
- 对表格、长文本、操作按钮和状态卡片进行响应式处理。
- 字体与 SVG 图标随包提供，不依赖外部字体或图标服务。
- 提供英文与简体中文；中文采用可编辑的标准 LuCI PO 翻译文件。

![Lumen 浅色桌面界面，使用演示数据](docs/screenshots/desktop-light.png)

<img src="docs/screenshots/mobile.png" width="360" alt="Lumen 手机布局，使用演示数据">

**截图均使用合成演示数据，不代表设备性能或实际网络状态。**

## 兼容范围

v1.0.0 面向 **OpenWrt 25.12 系列的 ucode LuCI**。依赖 `luci-base`、`luci-mod-status` 和作为卸载回退的 `luci-theme-bootstrap`，不依赖代理、Docker、广告过滤或任何特定硬件。它保留原生 LuCI 页面，自带页面全部位于 `admin/lumen/` 下。

发布时完成的是源码审查、静态检查和演示界面检查。主题的前身曾在实际设备运行，并收到 iPhone Safari 滚动修复的验证；**本次独立软件包尚未完成全新 SDK 构建、全新安装、重启或跨固件版本测试**，不应将前身运行情况等同于此版本软件包验收。旧 Lua LuCI、厂商定制页面及未来 LuCI 版本不在已验证范围内。

字体文件约 6.53 MB（未压缩），另有脚本、样式和模板，请为包及升级留出足够空间。

## 从源码构建

使用与目标设备固件匹配的 OpenWrt 25.12 SDK 或源码树，并按其官方文档准备编译环境。以下操作在 **SDK／源码树根目录** 执行：

```sh
./scripts/feeds update luci
./scripts/feeds install luci-base luci-mod-status luci-theme-bootstrap
git clone --branch v1.0.0 --depth 1 https://github.com/qidlek114/luci-theme-lumen.git package/luci-theme-lumen
make menuconfig
make package/luci-theme-lumen/compile V=s
```

在 `menuconfig` 中选择 `LuCI → Themes → luci-theme-lumen`；如需中文，同时启用 LuCI 的简体中文翻译。标准 `luci.mk` 会生成：

- `luci-theme-lumen`：主题本体。
- `luci-i18n-lumen-zh-cn`：中文翻译，安装到 `lumen.zh-cn.lmo`。

生成的包位于 SDK 的 `bin/packages/` 子目录。主题是架构无关资源，但仍需使用匹配目标系统的软件包格式和 LuCI API。**源码 ZIP／tar.gz 不是可直接安装的 APK。** 初次源码发布不附带未经 SDK 验证的二进制包。

## 安装与启用

1. 保留可用的原主题，并记录当前主题。先在备用设备或可恢复的测试环境验证。
2. 通过受信任、已配置签名密钥的软件源，或固件正常接受的已签名软件包，安装主题及可选的中文翻译包。不要关闭软件包签名校验。
3. 安装沿用 LuCI 标准生命周期，可能清理 LuCI 缓存并重载 `rpcd` 以加载权限；它不重启网络、防火墙或代理服务。重新登录即可刷新会话和菜单。
4. 在 **系统 → 系统 → 语言和界面** 中手动选择 **Lumen**。安装脚本只登记主题，不自动切换当前主题。
5. 在 **Lumen → 外观** 调整配色和界面名称；在 **Lumen → 仪表盘／实时图表** 查看数据。

默认 `/etc/config/lumen`：

```uci
config theme 'main'
    option style 'default'
    option mode 'auto'
```

`style` 可选 `default`、`claude`；`mode` 可选 `auto`、`light`、`dark`。可选的 `hostname` 和 `model` 只改变界面显示，留空时读取实际设备信息。此文件作为配置文件保留，升级时由软件包管理器处理本地修改。

## 回退与卸载

建议先在 LuCI 的“语言和界面”中切回仍已安装的主题，再卸载 Lumen 和对应翻译包。如果卸载时仍选中 Lumen，卸载脚本会把界面切回依赖中保留的 Bootstrap。若浏览器已无法打开界面，可通过已有管理连接将 `luci.main.mediaurlbase` 恢复为事先记录的原主题路径，提交 `luci` 配置后刷新浏览器；无需修改网络、DNS 或代理设置。

## 本次公开版审查

- 从部署副本整理为独立主题包；不包含路由器备份、真实主机清单、网络或代理配置。
- 默认配置不包含个人显示名称或部署环境固定值；链接使用 LuCI 路径生成，接口和状态从系统读取。
- 自定义页面移到 `admin/lumen/`，避免覆盖系统原有状态页面；安装不强制接管当前主题。
- 权限限定为仪表盘／图表所需的只读统计，以及 `lumen` 外观配置写入。
- 补齐图表依赖、可编辑中文翻译、字体／图标／基础主题的许可证与署名。

这不是安全认证，也不承诺所有第三方插件的布局都兼容。反馈问题时，请提供固件、LuCI 和浏览器版本、页面路径与去除隐私信息的截图。

## 开发与验证

```sh
node scripts/check.mjs
```

目录结构：`htdocs/` 安装到 `/www/`；`root/` 映射到系统根目录；`po/zh_Hans/lumen.po` 由 LuCI 工具链编译成独立中文翻译包。源码包不携带设备配置或通用的远程安装脚本。

## 许可

Lumen 原创代码使用 [Apache-2.0](LICENSE)。基础样式和模板来自 LuCI Bootstrap；Lucide／Feather 图标使用 ISC／MIT；字体使用 SIL OFL 1.1。完整来源与归属见 [NOTICE](NOTICE) 和 [licenses](licenses)。
