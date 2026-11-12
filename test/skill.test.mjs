import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {egoBrowserSkill as skill} from '../dsh/skill.mjs';

test('/ego-browser resolves to loopback-only instructions with no CLI fallback',async()=>{
  assert.equal(skill.name,'ego-browser');
  assert.equal(skill.provider,'ego');
  assert.equal(skill.invocation.modelInvocable,true);
  assert.equal(skill.invocation.userInvocable,true);
  assert.equal(skill.source,'runtime');
  assert.match(skill.content,/ROUTE: EGO_LOOPBACK_ONLY/);
  assert.match(skill.content,/ego_loopback_browser/);
  assert.match(skill.content,/report the exact error and stop/);
  assert.doesNotMatch(skill.content,/ego-browser nodejs|ego-browser skill/);
  assert.equal(skill.path,undefined);
  assert.equal(skill.resourceBase,undefined);
});
test('main package exclusively exports the new loopback plugin',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.name,'@cyrusxc5/better-ego-browser');
  assert.equal(pkg.exports['./dsh'],'./dsh/plugin.mjs');
  const plugin=await readFile(new URL('../dsh/plugin.mjs',import.meta.url),'utf8');
  assert.match(plugin,/registerEgoBrowserSkill\(ctx\)/);
  assert.doesNotMatch(plugin,/registerProvider/);
  assert.match(plugin,/\['tools', 'skills', 'agents'\]/);
});
