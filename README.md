# ego_lite_for_DSH

DeepSeek Harness 插件，连接已安装的官方 ego lite。包名为 `dsh-ego-lite`。

## 两条通道

| 功能 | 实现 | DSH 工具名称 |
| --- | --- | --- |
| 官方 daemon MCP | `@deepseek-ai/dsh-mcp-client`，Streamable HTTP + `Authorization: Bearer …` | `mcp__ego__<官方工具名>` |
| 官方浏览器指南 | 官方 `ego-browser.exe skill` | `mcp__ego_browser__skill` |
| 官方浏览器操作 | 官方 `ego-browser.exe nodejs`，UTF-8 脚本文件 | `mcp__ego_browser__run_js` |

不包含 Linux runtime、Chromium 下载器、CDP 兜底或自建浏览器 profile。不会修改 Claude/Codex 设置或禁用其他浏览器插件。进程启动不经过 shell，工具取消信号与超时传递到官方 CLI，调用结束删除临时脚本；任务空间按官方指南由脚本显式结束。

**官方接口的边界：**目前官方 daemon 的 `/mcp` 提供 Ego 会话、项目、任务等工具，不提供浏览器点击/截图/JS 工具。它的 Bearer token 绑定官方 provider session，不能用外部集成凭证替代。`/mcp/external` 提供面向外部客户端的项目/任务工具，使用官方配对凭证。浏览器自动化通过独立的官方 CLI 通道完成。两个端点的工具集合和凭证不能互换。

## 安装到 DSH

需要 Node.js 22+、已安装官方 Windows ego lite、具有 `@deepseek-ai/dsh-mcp-client` 的 DeepSeek Harness。DSH 已提供 MCP 客户端 peer dependency；普通 Node 环境只运行测试/诊断，不能代替 DSH host。

在项目目录执行 `npm ci`，然后 `npm pack`。在 DSH 插件管理器安装生成的 `dsh-ego-lite-0.1.0.tgz`，或在 DSH profile 目录使用其包管理器添加这个本地包，并在 `dsh.profile.bundles` 加入 `dsh-ego-lite`。安装后重载插件或重启 DSH。

默认启用官方浏览器工具。MCP 默认关闭，配好凭证后显式开启，避免缺少凭证导致整项插件启动失败。

```yaml
- id: ego-lite-official
  name: dsh-ego-lite
  config:
    browserEnabled: true
    mcpEnabled: false
    # 留空时使用 EGO_BROWSER_CLI 或官方 active_version_dir junction
    egoCli: ''
```

先停用旧 `dsh-ego-browser` 条目，避免重复或残留加载错误。此包不会导入旧 profile 或旧运行时。

## 开启认证 HTTP MCP

使用官方 Ego 设置中的外部集成创建并配对凭证。官方 CLI 将凭证保存在 `~/.ego/mcp/credentials/<integrationId>.json`；本插件读取该文件，不把 token 写入 profile 或仓库。

```yaml
- id: ego-lite-official
  name: dsh-ego-lite
  config:
    browserEnabled: true
    mcpEnabled: true
    endpoint: http://127.0.0.1:3773/mcp/external
    tokenFile: C:/Users/YOU/.ego/mcp/credentials/YOUR_INTEGRATION_ID.json
    toolCallTimeoutMs: 90000
```

端口以官方 `~/.ego/userdata/server-runtime.json` 的 `origin` 为准。只允许 loopback HTTP，路径为 `/mcp` 或 `/mcp/external`，拒绝 URL 内的账号密码、query 和 fragment。daemon 重启换端口时更新 endpoint 并重载插件；凭证更新后同样需要重载。连接、发现和工具同步失败会明确报错。

若已有合法的官方 provider-session token，可配置 `/mcp`，用环境变量 `EGO_AGENT_GATEWAY_URL` 和 `EGO_AGENT_GATEWAY_TOKEN`，或 `endpoint` 加 `tokenFile`。不读取其他进程环境，不伪造 provider session。

配置优先级：`endpoint` > `EGO_AGENT_GATEWAY_URL` > `EGO_MCP_URL`；凭证为 `tokenFile` / `EGO_MCP_TOKEN_FILE` > `tokenEnv` 指定的环境变量（默认 `EGO_AGENT_GATEWAY_TOKEN`）。凭证文件支持纯 token 或含 `credential` / `bearerToken` 的 JSON。

可使用 `scripts/start-daemon.ps1` 启动已安装的官方 daemon；不会自动开网页或创建项目。如果明确授权全部项目的 30 天集成，可运行 `node scripts/pair-local.mjs --confirm-all-projects`，授予项目读取、任务创建/读取/等待、本地 runtime 权限，生成不含 token 的 `.connection.local.json` 供复制配置。该辅助命令不会授予 full-access。需要更窄的项目范围时，通过官方设置选择项目后配对。未授权时不要运行这个命令。

## 浏览器使用

模型先调用 `mcp__ego_browser__skill` 读取当前安装版完整指南，再调用 `mcp__ego_browser__run_js`，参数为 `{ "code": "…" }`。插件会检查已读完整指南，并用临时 UTF-8 `.mjs` 文件运行脚本，支持中文。

```js
const task = await taskSpace('查询示例');
console.log({ spaceId: task.spaceId });
const page = task.page('p1');
await page.goto('https://example.com');
console.log(await page.snapshot());
// 同一目标后续调用用返回的 spaceId 恢复；真正结束时再 finish。
await task.finish({ keep: [] });
```

脚本使用官方文档列出的 API，截图保存为本地文件再由支持本地文件的工具查看。CLI 输出作为 MCP 文本传回，插件不会把截图文件自动转换为图片块。取消执行会终止 CLI 子进程，但已经发生的网页操作可能保留；恢复时检查原任务空间。

浏览器进程依旧使用官方用户登录态。不要在脚本中打印秘密。CLI 子进程环境会过滤名称含 KEY/PASSWORD/SECRET/TOKEN 的变量。读取指南标记在插件重载后重置，升级官方 CLI 后须重新读取指南。

## 验证

```powershell
npm ci
npm test
npm run smoke:browser
# 使用你实际配对后的环境变量；不要把 token 放入命令行或仓库
$env:EGO_MCP_URL = 'http://127.0.0.1:3773/mcp/external'
$env:EGO_MCP_TOKEN_FILE = 'C:/Users/YOU/.ego/mcp/credentials/YOUR_INTEGRATION_ID.json'
npm run doctor
```

`npm test` 覆盖地址/凭证校验、DSH HTTP bridge 配置、真实 MCP SDK 的初始化/发现/调用和浏览器指南门控/中文脚本/临时文件清理。`smoke:browser` 使用真实官方 CLI 打开独立空白页并结束测试空间。`doctor` 使用官方 MCP SDK 进行实际连接和工具发现，只输出工具名称，不输出 token。

本机创建时验证了官方 ego lite `0.6.2.7`、官方指南 `v2.2.0`、DSH 自带的 MCP client 接口和 MCP SDK `2.3.1`。官方 daemon 实际认证测试需要先完成授权配对。

接口依据：已安装官方 daemon 的 `src/router/mcp/agent/httpRoute.ts`、`src/router/mcp/external/httpRoute.ts`（发行版打包于 `local-ego-daemon/runtime`），以及 DSH 自带 `@deepseek-ai/dsh-mcp-client/README.zh.md` 与 `lib/index.js`。本项目不分发这些上游源码。
