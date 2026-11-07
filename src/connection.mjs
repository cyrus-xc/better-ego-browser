import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export function localEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Set endpoint or EGO_AGENT_GATEWAY_URL to the official daemon MCP URL.'); }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash
      || !['/mcp', '/mcp/external'].includes(url.pathname)) {
    throw new Error('Ego endpoint must be loopback HTTP at /mcp or /mcp/external, without credentials, query or fragment.');
  }
  return url.href;
}

function expandFile(value, home) {
  return value.startsWith('~/') || value.startsWith('~\\') ? path.join(home, value.slice(2)) : path.resolve(value);
}

export function safeToken(value) {
  if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value)) throw new Error('Missing or invalid Ego bearer credential.');
  return value.trim().replace(/^Bearer +/i, '');
}

// Explicit config > environment. The source file stays outside the package.
// The daemon issues credentials; this adapter never invents or extracts one.
export async function resolveConnection(config = {}, { env = process.env, home = homedir(), read = readFile } = {}) {
  const endpoint = localEndpoint(config.endpoint || env.EGO_AGENT_GATEWAY_URL || env.EGO_MCP_URL);
  const tokenEnv = config.tokenEnv || 'EGO_AGENT_GATEWAY_TOKEN';
  const tokenFile = config.tokenFile || env.EGO_MCP_TOKEN_FILE;
  let token;
  if (tokenFile) {
    let raw;
    try { raw = await read(expandFile(tokenFile, home), 'utf8'); }
    catch { throw new Error('Cannot read Ego credential file; check tokenFile and file permissions.'); }
    const text = raw.replace(/^\uFEFF/, '').trim();
    if (text.startsWith('{')) {
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('Ego credential file contains invalid JSON.'); }
      if (data.expiresAt && (!Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now())) throw new Error('Ego credential expired; pair the integration again.');
      token = data.credential ?? data.bearerToken;
    } else token = text;
  } else token = env[tokenEnv];
  return { endpoint, token: safeToken(token) };
}

export function bridgeConfig(connection, config = {}) {
  const timeout = config.toolCallTimeoutMs ?? 90000;
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 2147483647) throw new Error('toolCallTimeoutMs must be an integer between 1000 and 2147483647.');
  return {
    serverName: 'ego', transport: 'streamable-http', url: connection.endpoint,
    headers: { Authorization: `Bearer ${connection.token}` },
    toolCallTimeoutMs: timeout, failOnStartupError: true,
    maxInstructionBytes: 32768,
    reconnect: { enabled: true, initialDelayMs: 500, maxDelayMs: 30000, maxAttempts: 10 }
  };
}

export async function activate(ctx, config, loadBridge, dependencies) {
  const connection = await resolveConnection(config, dependencies);
  const bridge = await loadBridge();
  // Cordis owns this child scope: disposal unregisters tools and closes HTTP.
  const child = ctx.plugin(bridge, bridgeConfig(connection, config));
  await child;
  return child;
}
