import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { localEndpoint, resolveConnection, activate } from '../src/connection.mjs';
import { browserTools, resolveCli } from '../src/browser.mjs';

test('reject remote endpoints, credential URLs, alternate protocols and unexpected routes', () => {
  for (const endpoint of ['https://127.0.0.1/mcp', 'http://example.com/mcp', 'http://u:p@localhost/mcp', 'http://localhost/mcp?token=secret', 'http://localhost/mcp#x', 'file:///mcp', 'http://localhost/other']) assert.throws(() => localEndpoint(endpoint));
  assert.equal(localEndpoint('http://127.0.0.1:3773/mcp'), 'http://127.0.0.1:3773/mcp');
  assert.equal(localEndpoint('http://[::1]:3773/mcp/external'), 'http://[::1]:3773/mcp/external');
});

test('credential file overrides environment and expired/invalid credentials fail without disclosure', async () => {
  const config = { endpoint: 'http://localhost:3773/mcp', tokenFile: '~/credential.json' };
  const connection = await resolveConnection(config, { home: '/home/test', env: { EGO_AGENT_GATEWAY_TOKEN: 'old' }, read: async () => '\uFEFF{"credential":"new"}' });
  assert.equal(connection.token, 'new');
  for (const raw of ['{"credential":"secret","expiresAt":"2000-01-01"}', '{secret', '{"credential":"secret\\r\\nInjected: yes"}']) {
    await assert.rejects(resolveConnection(config, { read: async () => raw }), error => !error.message.includes('secret'));
  }
  await assert.rejects(resolveConnection({ endpoint: config.endpoint }, { env: {} }), /credential/);
});

test('DSH child is an authenticated HTTP client in the ego namespace, with readiness awaited', async () => {
  let options;
  let ready = false;
  const fakeBridge = {};
  await activate({ plugin(bridge, config) { assert.equal(bridge, fakeBridge); options = config; return Promise.resolve().then(() => { ready = true; }); } },
    { endpoint: 'http://localhost:3773/mcp' }, async () => fakeBridge, { env: { EGO_AGENT_GATEWAY_TOKEN: 'test-token' } });
  assert.equal(ready, true);
  assert.equal(options.transport, 'streamable-http');
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  assert.equal(options.serverName, 'ego');
  assert.equal(options.command, undefined);
  assert.equal(options.failOnStartupError, true);
});

test('real MCP SDK initializes, discovers and calls tools with Authorization on every POST', async t => {
  const calls = [];
  const server = createServer(async (req, res) => {
    assert.equal(req.url, '/mcp');
    assert.equal(req.headers.authorization, 'Bearer test-token');
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const message = JSON.parse(body); calls.push(message.method);
    if (!('id' in message)) { res.writeHead(202).end(); return; }
    let result;
    if (message.method === 'initialize') result = { protocolVersion: message.params.protocolVersion, serverInfo: { name: 'official-daemon-fixture', version: '1.0' }, capabilities: { tools: {} } };
    else if (message.method === 'tools/list') result = { tools: [{ name: 'ego_context', description: 'fixture', inputSchema: { type: 'object', properties: {} } }] };
    else if (message.method === 'tools/call') result = { content: [{ type: 'text', text: 'authenticated' }] };
    else result = {};
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const client = new Client({ name: 'integration-test', version: '1.0' });
  t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.address().port}/mcp`), { requestInit: { headers: { Authorization: 'Bearer test-token' } } }));
  assert.equal((await client.listTools()).tools[0].name, 'ego_context');
  assert.equal((await client.callTool({ name: 'ego_context', arguments: {} })).content[0].text, 'authenticated');
  assert.ok(calls.includes('notifications/initialized'));
});

test('browser execution requires full guide; Unicode scripts travel by UTF-8 file and temp files are removed', async () => {
  const { readFile, access } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  let scriptPath;
  const tools = browserTools('official.exe', {}, async (_cli, args) => {
    if (args[0] === 'skill') return { content: [{ type: 'text', text: '[ego-browser:skill] end of guide v2.2.0' }] };
    scriptPath = fileURLToPath(args[2].slice("await import('".length, -2));
    assert.equal(await readFile(scriptPath, 'utf8'), 'console.log("中文")');
    return { content: [{ type: 'text', text: '中文' }] };
  });
  assert.equal((await tools[1].call({ code: 'console.log("中文")' })).isError, true);
  await tools[0].call({});
  assert.equal((await tools[1].call({ code: 'console.log("中文")' })).content[0].text, '中文');
  await assert.rejects(access(scriptPath));
});

test('browser launcher rejects script runtimes and non-absolute CLI paths', async () => {
  await assert.rejects(resolveCli({ egoCli: 'runtime/ego-linux/index.mjs' }, {}), /official/);
});
