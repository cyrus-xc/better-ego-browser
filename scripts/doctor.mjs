import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { resolveConnection } from '../src/connection.mjs';

let client;
try {
  const { endpoint, token } = await resolveConnection();
  client = new Client({ name: 'dsh-ego-lite-doctor', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' }
  });
  await client.connect(transport);
  const tools = await client.listTools();
  console.log(JSON.stringify({ connected: true, endpoint, tools: tools.tools.map(tool => tool.name) }, null, 2));
} catch {
  // SDK/network errors can include headers or response bodies. Do not log them.
  console.error('Ego connection failed. Check daemon URL, token validity, and whether this credential belongs to the chosen endpoint.');
  process.exitCode = 1;
} finally {
  try { await client?.close(); } catch { /* A stateless daemon may reject DELETE. */ }
}
