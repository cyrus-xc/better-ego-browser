import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../skills/ego-browser/SKILL.md',import.meta.url),'utf8');
const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
if (!match) throw Error('Invalid bundled ego-browser Skill');
const description = /^description:\s*(.+)$/m.exec(match[1])?.[1];
if (!description) throw Error('Missing ego-browser Skill description');

export const egoBrowserSkill = Object.freeze({
  name:'ego-browser',description,provider:'ego',source:'runtime',
  invocation:{modelInvocable:true,userInvocable:true},
  content:match[2].trimStart(),
});

export function registerEgoBrowserSkill(ctx) {
  ctx.skills.register(egoBrowserSkill);
  ctx.effect(() => {
    const registrations = new Map();
    const attach = agent => {
      if (registrations.has(agent)) return;
      const dispose = agent.ctx.effect(() => {
        const registration = agent.ctx.inject(['skills'], skillCtx => {
          skillCtx.skills.register(egoBrowserSkill);
        });
        return async () => {
          await registration.dispose();
          registrations.delete(agent);
        };
      });
      registrations.set(agent,dispose);
    };
    const stopCreated = ctx.on('agent/created',({agent}) => attach(agent));
    for (const agent of ctx.agents.list()) attach(agent);
    return async () => {
      stopCreated();
      for (const dispose of [...registrations.values()]) await dispose();
      registrations.clear();
    };
  });
}
