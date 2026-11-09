import http from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm, mkdir, readFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const ACTIONS = ['health','spaces','create','navigate','snapshot','click','fill','screenshot','finish'];
const pluginVersion = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
export function validate(body) {
  if (!body || typeof body !== 'object' || !ACTIONS.includes(body.action)) throw Error('Unsupported action');
  const pick = { action: body.action };
  if (body.action === 'health' || body.action === 'spaces') return pick;
  if (body.action === 'create') {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) throw Error('Provide a goal name of 1–100 characters');
    pick.name = body.name; return pick;
  }
  if (!Number.isSafeInteger(body.spaceId) || body.spaceId < 0) throw Error('Provide the existing spaceId');
  pick.spaceId = body.spaceId;
  if (body.action === 'navigate') {
    const url = new URL(body.url);
    if (!['http:','https:'].includes(url.protocol) && url.href !== 'about:blank') throw Error('Only HTTP, HTTPS and about:blank navigation is allowed');
    if (url.username || url.password) throw Error('Credentials in URLs are unsupported');
    pick.url = url.href;
  }
  if (['click','fill'].includes(body.action)) {
    if (typeof body.selector !== 'string' || !body.selector || body.selector.length > 2000) throw Error('Provide a selector from the latest snapshot');
    pick.selector = body.selector;
  }
  if (body.action === 'fill') {
    if (typeof body.text !== 'string' || body.text.length > 16000) throw Error('Text limit exceeded');
    pick.text = body.text;
  }
  return pick;
}
export async function runOfficial(request, { cli, signal, artifactDir }) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ego-loopback-round-'));
  try {
    const payload = { ...request };
    if (request.action === 'screenshot') {
      await mkdir(artifactDir, { recursive: true });
      payload.artifactPath = path.join(artifactDir, randomBytes(12).toString('hex') + '.png');
    }
    const script = path.join(dir, 'round.mjs');
    const resultFile = path.join(dir, 'result.json');
    const moduleUrl = new URL('./browser-action.mjs', import.meta.url).href;
    await writeFile(script, 'const fs=await import("node:fs/promises");\nlet reply;try{const {dispatch}=await import('+JSON.stringify(moduleUrl)+');reply={ok:true,result:await dispatch(JSON.parse('+JSON.stringify(JSON.stringify(payload))+'))};}catch(error){reply={ok:false,error:error.message};}\nawait fs.writeFile('+JSON.stringify(resultFile)+',JSON.stringify(reply),"utf8");\n', 'utf8');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/KEY|PASSWORD|SECRET|TOKEN/i.test(key)));
    await new Promise((resolve, reject) => execFile(cli, ['nodejs','-e', "await import('"+pathToFileURL(script).href+"')"], { windowsHide: true, encoding: 'utf8', env, timeout: 45000, maxBuffer: 4*1024*1024, signal }, (error, out, err) => {
      if (error) { reject(new Error('Official CLI failed: '+(err || out || error.message).slice(-1800))); return; }
      resolve(out);
    }));
    const reply = JSON.parse(await readFile(resultFile,'utf8'));
    if (!reply.ok) throw Error(reply.error);
    const result = reply.result;
    if (request.action === 'screenshot') result.image = (await readFile(payload.artifactPath)).toString('base64');
    return result;
  } finally { await rm(dir, { recursive: true, force: true }); }
}
export async function startBridge(options = {}) {
  const token = randomBytes(32).toString('base64url');
  const cli = options.cli || path.join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe');
  const artifactDir = options.artifactDir || path.join(homedir(),'Desktop','ego-loopback-artifacts');
  const run = options.run || (request => runOfficial(request, { cli, artifactDir }));
  const spaces = new Set(options.initialSpaces || []);
  let queue = Promise.resolve(), closed = false;
  const server = http.createServer(async (req, res) => {
    const send = (status, data) => { if (!res.destroyed) res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }).end(JSON.stringify(data)); };
    if (req.headers.host !== '127.0.0.1:'+server.address().port || req.headers.origin) return send(403, { error:'Local non-browser client required' });
    const actual = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from('Bearer '+token);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return send(401, { error:'Unauthorized' });
    if (req.method !== 'POST' || req.url !== '/browser') return send(404,{error:'Not found'});
    let bytes = 0, text = '';
    try {
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 65536) return send(413,{error:'Request too large'}); text += chunk; }
      const request = validate(JSON.parse(text));
      const work = queue.then(async () => {
        if (closed) throw Error('Bridge closed');
        if (request.action === 'health') return { pluginVersion, transport:'authenticated-loopback-http', bootstrap:'official-cli-on-host', ownedSpaces:[...spaces], ownedSpacesScope:'created-by-this-plugin-instance-only', browserInventory:'use-spaces-action', arbitraryHostCode:false };
        if (!['create','spaces'].includes(request.action) && !spaces.has(request.spaceId)) throw Error('This bridge does not own the supplied spaceId');
        const result = await run(request);
        if (request.action === 'create') { if (!Number.isSafeInteger(result.spaceId)) throw Error('Invalid official task space'); spaces.add(result.spaceId); }
        if (request.action === 'finish') spaces.delete(request.spaceId);
        return result;
      });
      queue = work.catch(() => {});
      try { send(200,{ ok:true,result:await work }); } catch(error) { send(400,{ok:false,error:error.message}); }
    } catch { send(400,{error:'Invalid request'}); }
  });
  server.requestTimeout = 10000;
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  const endpoint = 'http://127.0.0.1:'+server.address().port+'/browser';
  return { endpoint, token, async close() {
    closed = true;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await queue;
  } };
}
export async function requestBridge(bridge, request, signal) {
  const response = await fetch(bridge.endpoint, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+bridge.token }, body:JSON.stringify(request), signal: signal || AbortSignal.timeout(60000), redirect:'error' });
  const result = await response.json();
  if (!response.ok || !result.ok) throw Error(result.error || 'Bridge request failed');
  return result.result;
}
