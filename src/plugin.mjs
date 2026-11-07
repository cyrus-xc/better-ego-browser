import z from '@deepseek-ai/schemastery';
import { activate } from './connection.mjs';
import { installBrowserTools } from './browser.mjs';

export const name = 'ego-lite-official';
export const inject = ['tools'];
export const Config = z.object({
  mcpEnabled: z.boolean().default(false).description('连接官方 daemon MCP；配置凭证后开启，未开启时仍提供官方浏览器工具'),
  browserEnabled: z.boolean().default(true).description('提供官方 CLI 浏览器工具'),
  egoCli: z.string().default('').description('官方 ego-browser.exe 绝对路径；留空使用 EGO_BROWSER_CLI 或官方 active_version_dir junction'),
  endpoint: z.string().default('').description('官方 daemon URL： http://127.0.0.1:<port>/mcp 或 /mcp/external；留空读取 EGO_AGENT_GATEWAY_URL / EGO_MCP_URL'),
  tokenEnv: z.string().default('EGO_AGENT_GATEWAY_TOKEN').description('Bearer 凭证环境变量名称'),
  tokenFile: z.string().default('').description('凭证文件路径：纯 token 或官方配对 JSON；优先于环境变量，文件请放在项目外'),
  toolCallTimeoutMs: z.number().step(1).min(1000).max(2147483647).default(90000).description('工具调用超时（毫秒）')
});

export async function apply(ctx, config) {
  const bridge = await import('@deepseek-ai/dsh-mcp-client');
  if (config.browserEnabled !== false) await installBrowserTools(ctx, bridge, config);
  if (config.mcpEnabled === true) await activate(ctx, config, async () => bridge);
}
