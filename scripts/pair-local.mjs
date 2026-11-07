// Pair through the official daemon and its official pairing CLI.
// Never print the pairing code or credential. Run with the daemon already started.
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveCli } from '../src/browser.mjs';
import { localEndpoint } from '../src/connection.mjs';

try {
  if (!process.argv.includes('--confirm-all-projects')) {
    throw new Error('Explicit approval required: 30 days, all Ego projects, read/create/wait tasks, local runtime.');
  }
  const base = process.env.EGO_HOME || path.join(homedir(), '.ego');
  const state = JSON.parse(await readFile(path.join(base, 'userdata/server-runtime.json'), 'utf8'));
  const endpoint = localEndpoint(`${state.origin}/mcp/external`);
  const origin = new URL(endpoint).origin;
  const response = await fetch(`${origin}/api/mcp/external/integrations`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'DeepSeek Harness ego_lite_for_DSH', clientKind: 'other',
      projectScope: 'all', capabilities: ['projects:read', 'tasks:create', 'tasks:read', 'tasks:wait', 'runtime:local'], expiresInDays: 30 }),
    signal: AbortSignal.timeout(10000), redirect: 'error'
  });
  if (!response.ok) throw new Error('integration creation failed');
  const setup = await response.json();
  const cli = await resolveCli();
  const daemon = path.join(path.dirname(cli), 'local-ego-daemon/index.mjs');
  execFileSync(process.execPath, [daemon, 'mcp', 'pair', '--code', setup.pairingCode, '--home-dir', base], {
    windowsHide: true, stdio: 'pipe', timeout: 30000
  });
  const tokenFile = path.join(base, 'mcp/credentials', `${setup.integration.integrationId}.json`);
  const config = { endpoint, tokenFile, mcpEnabled: true, browserEnabled: true };
  await writeFile(new URL('../.connection.local.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
  console.log(JSON.stringify({ paired: true, endpoint, integrationId: setup.integration.integrationId, expiresAt: setup.integration.expiresAt, config: '.connection.local.json' }, null, 2));
} catch {
  console.error('Pairing failed. Check the official daemon, EGO_HOME, and its local integration settings. No credential has been printed.');
  process.exitCode = 1;
}
