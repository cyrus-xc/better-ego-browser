import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSkillProvider} from '../dsh/skill-provider.mjs';

test('/ego-browser resolves to loopback-only instructions with no CLI fallback',async()=>{
  const provider=createSkillProvider();
  const [candidate]=await provider.list();
  const skill=await provider.get(candidate);
  assert.equal(skill.name,'ego-browser');
  assert.equal(skill.provider,'ego');
  assert.equal(skill.invocation.modelInvocable,true);
  assert.equal(skill.invocation.userInvocable,true);
  assert.equal(candidate.rank,600);
  assert.match(skill.content,/ROUTE: EGO_LOOPBACK_ONLY/);
  assert.match(skill.content,/ego_loopback_browser/);
  assert.match(skill.content,/report the exact error and stop/);
  assert.doesNotMatch(skill.content,/ego-browser nodejs|ego-browser skill/);
  assert.equal(await provider.get({...candidate,locator:'/unrelated'}),undefined);
});
test('main package exclusively exports the new loopback plugin',async()=>{
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.name,'@cyrusxc5/better-ego-browser');
  assert.equal(pkg.version,'0.3.3');
  assert.equal(pkg.exports['./dsh'],'./dsh/plugin.mjs');
  const plugin=await readFile(new URL('../dsh/plugin.mjs',import.meta.url),'utf8');
  assert.match(plugin,/createSkillProvider/);
  assert.match(plugin,/registerProvider/);
  assert.match(plugin,/\['tools', 'skills'\]/);
});
