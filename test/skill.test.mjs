import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import * as plugin from '../dsh/src/index.js';

test('official provider exposes a discoverable, invocable Skill with local resources', async () => {
  let provider;
  plugin.apply({ skills: { registerProvider(factory) { provider = factory(); } } });
  assert.deepEqual(plugin.inject, ['skills']);
  assert.equal(plugin.name, 'ego');
  const candidates = await provider.list();
  assert.equal(candidates.length, 1);
  const candidate = candidates[0];
  assert.equal(candidate.name, 'ego-browser');
  assert.equal(candidate.invocation.modelInvocable, true);
  assert.equal(candidate.invocation.userInvocable, true);
  const skill = await provider.get(candidate);
  assert.match(skill.content, /ego-browser skill/);
  assert.equal(skill.resourceBase.kind, 'directory');
  assert.equal(skill.path, candidate.locator);
  for (const file of ['SKILL.md', 'references/install.md', 'references/install-windows.md', 'references/install-macos.md', 'references/clearing-state.md', 'assets/logo.png']) {
    await access(path.join(skill.resourceBase.path, file));
  }
  assert.equal(await provider.get({ ...candidate, locator: '/unrelated/SKILL.md' }), undefined);
  assert.equal(await provider.get({ ...candidate, name: 'unrelated' }), undefined);
});

test('package loads the Skill adapter without MCP or runtime dependencies', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'ego-lite-for-dsh');
  assert.equal(pkg.version, '0.2.1');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.peerDependencies, undefined);
  assert.equal(pkg.exports['./dsh'], './dsh/src/index.js');
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.ok(patch.startsWith('- insert:\n'));
  assert.ok(patch.includes(`name: ${pkg.name}/dsh`));
});
