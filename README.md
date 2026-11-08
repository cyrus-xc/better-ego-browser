# ego_lite_for_DSH

为 DeepSeek Harness 注册 `ego-browser` Skill，使用已安装的官方 ego lite 浏览器完成网页任务。npm 包名为 [`@cyrusxc5/dsh-ego-lite`](https://www.npmjs.com/package/@cyrusxc5/dsh-ego-lite)。

采用官方 DSH Skill provider 的实现，随包提供完整 Skill 和引用资源。模型先运行 `ego-browser skill` 读取当前安装版指南，再通过 `ego-browser nodejs` 操作浏览器。

## 安装

需要 **DeepSeek Harness >=0.2.0**、**Node.js >=22**，并提前安装[官方 ego lite](https://lite.ego.app/)。确认 `ego-browser` 能从 DSH 的命令环境运行。

从 npm 安装本插件，`desktop` 可替换为你实际使用的 profile：

```sh
dsh plugin --profile desktop add @cyrusxc5/dsh-ego-lite
```

使用 DSH 插件管理界面时，搜索或输入 npm 包名 `@cyrusxc5/dsh-ego-lite`。安装后重载插件或启动新的 DSH 会话。

若提示找不到 `ego-browser`，请先完成官方浏览器安装及首次启动设置，并重新打开 DSH，让它读取更新后的 PATH。

## 使用

在 DSH 中发送：

> 使用 ego-browser Skill 打开 example.com，读取页面标题。

Skill 支持模型自动调用和用户主动调用。浏览器 API、任务空间和清理方式以官方 CLI 输出的当前指南为准。本插件通过 DSH 的本地命令执行能力调用官方 CLI，无需额外启动 daemon、配置 HTTP 地址或提供 token。

## 来源与边界

这是独立维护的 npm 包，**不是 CitroLabs 官方发布包**。官方发布包名为 `@ego-lite/dsh-plugin`，与本包提供相同的上游 Skill 集成；请选择其中一个安装，避免重复注册。

适配器与完整 Skill 文件来自 [citrolabs/ego-lite](https://github.com/citrolabs/ego-lite)，固定版本见 [UPSTREAM.json](https://github.com/cyrus-xc/ego_lite_for_DSH/blob/main/UPSTREAM.json)。上游文件保留原文和 [CitroLabs MIT 许可](https://github.com/cyrus-xc/ego_lite_for_DSH/blob/main/THIRD_PARTY_LICENSE.txt)。本项目维护自己的包名、安装清单和发布说明。

- [官方 DSH 适配器源码](https://github.com/citrolabs/ego-lite/blob/bacaece43900e8ca68eea3b6f1663835ea38df9e/plugins/ego/dsh/src/index.js)
- [官方 DSH 安装说明](https://github.com/citrolabs/ego-lite/blob/bacaece43900e8ca68eea3b6f1663835ea38df9e/plugins/ego/README.md#deepseek-harness)

本插件注册 Skill，不提供独立的 MCP 浏览器工具，也不附带 Chromium、Linux runtime、浏览器下载器或登录数据迁移功能。官方浏览器由用户单独安装并维护。

## 从本项目早期本地版本升级

`dsh-ego-lite` 曾是本项目的本地包名，目前 npm 上的同名包属于其他作者。本项目从 npm 发布时改名为 `@cyrusxc5/dsh-ego-lite`。如果此前从本仓库的 `.tgz` 安装过 `dsh-ego-lite`，请先移除那个本地版本和它的手动配置条目，再按上述 npm 命令安装。

`0.1.0` 的 `mcpEnabled`、`browserEnabled`、`endpoint`、`tokenFile` 等选项已移除。当前 bundle 加载 `@cyrusxc5/dsh-ego-lite/dsh`，不需要配置字段。

## 开发检查

```sh
npm ci
npm test
npm pack --dry-run
```

项目没有 npm 依赖和安装脚本。测试在独立 Node 环境检查 Skill provider 的发现、读取和资源可达性，不启动 DSH。发布物包含适配器、完整 Skill、安装清单和许可证。
