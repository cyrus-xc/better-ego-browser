// Run after a real DSH browser task:
// node scripts/verify-dsh-session.cjs session-<uuid> [minimum-completed-turns] [required-actions...]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const [id, minimumTurns = '1', ...requiredActions] = process.argv.slice(2);
assert.match(id || '', /^session-[a-f0-9-]+$/i, 'Provide an exact DSH session id');
assert.ok(Number.isSafeInteger(Number(minimumTurns)) && Number(minimumTurns) > 0, 'Invalid turn count');
const sessionsRoot = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'sessions');
const matches = fs.readdirSync(sessionsRoot, {withFileTypes: true})
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(sessionsRoot, entry.name, id, 'session.v4.jsonl.zstd'))
  .filter(file => fs.existsSync(file));
assert.equal(matches.length, 1, 'Expected one persisted session');
const rows = zlib.zstdDecompressSync(fs.readFileSync(matches[0])).toString('utf8').trim().split('\n').map(JSON.parse);
const approvals = rows.filter(row => row.type === 'approval/asked');
const dispatches = rows.filter(row => row.type === 'tool/ptc-dispatch' || (row.type === 'tool/call' && row.data.name !== 'run_code'));
const escalations = dispatches.filter(row => /danger-full-access|require_escalated/.test(row.data.arguments?.sandbox_permissions || ''));
const shells = dispatches.filter(row => /^(pwsh|bash|shell|exec_command|terminal.*)$/.test(row.data.name));
const completed = rows.filter(row => row.type === 'turn/end' && row.data.reason?.kind === 'completed');
const skills = rows.filter(row => row.type === 'user/message' && row.data.source?.kind === 'skill-invocation' && row.data.source.name === 'ego-browser');
const browserCalls = dispatches.filter(row => row.data.name === 'ego_loopback_browser');
const actions = browserCalls.map(row => row.data.arguments.action);
const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
const sandboxModes = rows.filter(row => row.type === 'sandbox/mode').map(row => row.data.mode);
const approvalPolicies = rows.filter(row => row.type === 'approval/policy').map(row => row.data.policy);

assert.ok(sandboxModes.length > 0 && sandboxModes.every(mode => mode === 'workspace-write'), 'Verification must keep workspace-write throughout');
assert.ok(approvalPolicies.length > 0 && approvalPolicies.every(policy => policy === 'ask'), 'Verification must keep approval prompts enabled');
assert.equal(approvals.length, 0, 'Browser task requested approval');
assert.equal(escalations.length, 0, 'Browser task requested sandbox escalation');
assert.equal(shells.length, 0, 'Browser task used a shell instead of loopback');
assert.ok(completed.length >= Number(minimumTurns), 'Required browser turns did not complete');
assert.ok(skills.length > 0, 'No /ego-browser Skill invocation recorded');
assert.ok(skills.every(row => row.data.content.some(block => block.text?.includes('ego_loopback_browser'))), 'An invocation loaded the old CLI Skill');
assert.ok(browserCalls.length > 0, 'No real loopback calls recorded');
assert.ok(browserCalls.every(row => !row.data.isError), 'A loopback operation failed');
const healthResults = browserCalls.filter(row => row.data.arguments.action === 'health')
  .map(row => JSON.parse(row.data.content.find(block => block.type === 'text').text));
assert.ok(healthResults.length > 0 && healthResults.every(result => result.pluginVersion === version), 'DSH loaded a stale plugin version');
for (const action of requiredActions) assert.ok(actions.includes(action), `Missing real browser action: ${action}`);
console.log(JSON.stringify({verdict:'PASS',sessionId:id,pluginVersion:version,sandboxMode:'workspace-write',approvalPolicy:'ask',completedTurns:completed.length,skillInvocations:skills.length,approvalRequests:approvals.length,escalations:escalations.length,shellCalls:shells.length,actions}, null, 2));
