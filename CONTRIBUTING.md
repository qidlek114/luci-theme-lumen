# Contributing / 参与反馈

欢迎通过 Issue 反馈问题、提出建议，也欢迎提交小范围、易审阅的 Pull Request。PR 不会自动合并，由维护者审查和决定。

## 报告问题

- 先搜索已有 Issue，说明主题版本、固件／LuCI 版本、浏览器、屏幕宽度和出问题的页面路径。
- 提供可重复的步骤、预期结果和实际结果；截图请遮去公网 IP、MAC、设备清单及个人信息。
- 不要上传路由器完整备份、密码、密钥、Cookie、订阅链接或未脱敏的日志。
- v1.0.0 是面向 OpenWrt 25.12 ucode LuCI 的源码发布，独立 SDK 构建及全新安装仍待验证。

## 提交改动

1. 先用 Issue 讨论较大的功能或兼容范围变动；小修复可以直接提 PR。
2. 每个 PR 聚焦一个问题，说明触发条件、改动效果与实际测试范围。
3. 执行 `node scripts/check.mjs`。界面改动应附深／浅色和窄屏对照，说明浏览器；没有测试的范围请明确写出。
4. 不加入网络、代理或设备专用配置，不提交生成的凭据、备份或本机日志。保留原作者署名和依赖许可。
5. 提交者必须有权贡献这些改动；新增原创内容沿用本仓库 Apache-2.0 许可，第三方内容保留其原许可。

## English

Issues and focused pull requests are welcome. The maintainer reviews and decides what to merge; submission never grants write access or triggers automatic merging.

Report the Lumen, firmware, LuCI and browser versions, viewport width, page path, reproducible steps, and expected/actual results. Redact screenshots and logs. Never share full router backups, passwords, keys, cookies, subscriptions or personal device inventories.

Discuss large changes in an issue first. Run `node scripts/check.mjs`, keep each PR focused, include relevant desktop/mobile and light/dark UI evidence, and state what remains untested. Preserve third-party notices and only contribute work you have the right to license. New original contributions use Apache-2.0.
