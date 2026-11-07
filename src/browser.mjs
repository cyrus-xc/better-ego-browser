import { access, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function resolveCli(config = {}, env = process.env) {
  const candidates = [config.egoCli, env.EGO_BROWSER_CLI,
    path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe')].filter(Boolean);
  for (const file of candidates) {
    if (!path.isAbsolute(file) || path.basename(file).toLowerCase() !== 'ego-browser.exe') throw new Error('egoCli must be an absolute path to the official ego-browser.exe.');
    try { await access(file); return file; } catch { /* The official junction may not be installed. */ }
    if (file === config.egoCli || file === env.EGO_BROWSER_CLI) throw new Error('Configured official ego-browser.exe does not exist.');
  }
  throw new Error('Official ego-browser.exe not found. Install ego lite or configure egoCli.');
}

export function runCli(file, args, { signal, timeout = 90000 } = {}) {
  return new Promise((resolve, reject) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/KEY|PASSWORD|SECRET|TOKEN/i.test(key)));
    execFile(file, args, { encoding: 'utf8', windowsHide: true, timeout,
      maxBuffer: 8 * 1024 * 1024, signal, env }, (error, stdout, stderr) => {
      if (signal?.aborted) { reject(new Error('Browser operation cancelled.')); return; }
      if (error) {
        resolve({ isError: true, content: [{ type: 'text', text: `Official CLI failed (${error.killed ? 'timeout/output limit' : error.code ?? 'launch error'}).\n${stdout || stderr || 'No output.'}` }] });
      } else resolve({ content: [{ type: 'text', text: stdout || stderr || '(completed without output)' }] });
    });
  });
}

export function browserTools(cli, config = {}, run = runCli) {
  let guideRead = false;
  const timeout = config.toolCallTimeoutMs ?? 90000;
  return [
    {
      name: 'mcp__ego_browser__skill', rawName: 'skill',
      description: 'Read the installed official ego-browser usage guide before any browser work. Follow its TaskSpace ownership, verification and cleanup rules. Reread after an upgrade.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      call: async (_args, execution = {}) => {
        const result = await run(cli, ['skill'], { signal: execution.signal, timeout });
        guideRead = !result.isError && result.content.some(block => block.text?.includes('[ego-browser:skill] end of guide'));
        if (!result.isError && !guideRead) return { isError: true, content: [{ type: 'text', text: 'Official guide is incomplete. Read the full guide through the official CLI before running browser scripts.' }] };
        return result;
      }
    },
    {
      name: 'mcp__ego_browser__run_js', rawName: 'run_js',
      description: 'Run JavaScript using the official ego-browser nodejs runtime. First call mcp__ego_browser__skill. Use documented helpers, one TaskSpace per goal, resume its ID across calls, print required results, and finish the space. The script executes as Node, not page JavaScript. Use console.log for text output. Return large screenshots through saved files when appropriate.',
      inputSchema: { type: 'object', properties: { code: { type: 'string', minLength: 1, maxLength: 262144 } }, required: ['code'], additionalProperties: false },
      call: async ({ code }, execution = {}) => {
        if (!guideRead) return { isError: true, content: [{ type: 'text', text: 'Call mcp__ego_browser__skill and read the complete official guide first.' }] };
        if (typeof code !== 'string' || !code.trim() || code.length > 262144) throw new Error('code must contain 1–262144 characters.');
        const dir = await mkdtemp(path.join(tmpdir(), 'dsh-ego-official-'));
        try {
          const script = path.join(dir, 'round.mjs');
          await writeFile(script, code, 'utf8');
          // No shell, inherited child token, browser launch flags or custom Chromium profile.
          return await run(cli, ['nodejs', '-e', `await import('${pathToFileURL(script).href}')`], { signal: execution.signal, timeout });
        } finally { await rm(dir, { recursive: true, force: true }); }
      }
    }
  ];
}

export async function installBrowserTools(ctx, bridge, config = {}) {
  const cli = await resolveCli(config);
  for (const tool of browserTools(cli, config)) {
    const definition = bridge.createMcpToolDefinition(ctx, tool);
    ctx.effect(() => ctx.tools.register(definition));
  }
}
