# ego_lite_for_DSH

采用官方 DSH 集成形式的 ego lite 插件，包名为 `dsh-ego-lite`。

插件通过 `ctx.skills.registerProvider()` 注册 `ego-browser` Skill。模型读取 Skill 后，先运行官方 `ego-browser skill` 获取当前安装版指南，再通过官方 `ego-browser nodejs` 操作浏览器。使用 DSH 自带的本地命令执行能力。

本版本不需要 MCP daemon、HTTP 服务、token 或配对，不包含自建浏览器工具、Linux runtime 或浏览器下载器。

## 来源

适配器与完整 Skill 文件直接复制自 [citrolabs/ego-lite](https://github.com/citrolabs/ego-lite)，固定版本见 [UPSTREAM.json](./UPSTREAM.json)。上游文件保持原文，保留 [CitroLabs MIT 许可](./THIRD_PARTY_LICENSE.txt)。本仓库提供独立包名及打包配置，并非官方发布包。

- [官方 DSH 适配器](https://github.com/citrolabs/ego-lite/blob/bacaece43900e8ca68eea3b6f1663835ea38df9e/plugins/ego/dsh/src/index.js)
- [官方插件说明](https://github.com/citrolabs/ego-lite/blob/bacaece43900e8ca68eea3b6f1663835ea38df9e/plugins/ego/README.md#deepseek-harness)
- 官方发布包是 `@ego-lite/dsh-plugin`；本项目保留自己的包名以区分来源。

## 安装

需要 DSH >=0.2.0、Node.js >=22、已安装的官方 ego lite。`ego-browser` 应能从 DSH 的命令环境执行。

在项目目录运行 `npm pack`，生成 `dsh-ego-lite-0.2.0.tgz`。使用 DSH 插件安装界面导入，或按官方方式执行（替换为实际 profile）：

```powershell
dsh plugin --profile desktop add C:/Users/Cyrus/Desktop/ego_lite_for_DSH/dsh-ego-lite-0.2.0.tgz
```

也可以直接安装官方发行包：

```powershell
dsh plugin --profile desktop add @ego-lite/dsh-plugin
```

选择其中一个即可，重复安装会提供相同的 Skill。

本包 bundle patch 加载 `dsh-ego-lite/dsh`。手动配置只需要：

```yaml
- id: ego-lite-official
  name: dsh-ego-lite/dsh
```

`0.1.0` 的 `mcpEnabled`、`browserEnabled`、`endpoint`、`tokenFile` 等配置在 `0.2.0` 中已移除。升级时删除这些配置并重载插件。历史提交中的自建 MCP 实现不属于当前版本。

## 使用

在 DSH 请求使用 `ego-browser` Skill，并说明浏览器任务。Skill 可由模型调用，也可由用户调用；浏览器规则、任务空间管理和清理以官方 CLI 输出的当前指南为准。

## 本地检查

`npm test` 只运行脱离 DSH 的 Node 检查，核对 Skill provider 的发现/读取契约和资源文件可达性。项目无 npm 依赖。`npm pack --dry-run` 用于检查发布内容。

按用户要求，本次不启动 DSH、不在 DSH 内验证，也不执行浏览器任务。所有项目文件和安装包保存于 C 盘。
