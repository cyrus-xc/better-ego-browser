import {readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const skillPath = fileURLToPath(new URL('../skills/ego-browser/SKILL.md',import.meta.url));
const source = readFileSync(skillPath,'utf8');
const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
if (!match) throw Error('Invalid bundled ego-browser Skill');
const description = /^description:\s*(.+)$/m.exec(match[1])?.[1];
if (!description) throw Error('Missing ego-browser Skill description');
const candidate = Object.freeze({
  name:'ego-browser',description,provider:'ego',source:'bundled',
  invocation:{modelInvocable:true,userInvocable:true},
  rank:600,locator:skillPath,path:skillPath,resourceBase:{kind:'directory',path:dirname(skillPath)},
});
export function createSkillProvider() {
  return {name:'ego',async list(){return [candidate];},async get(selected){
    if(selected?.name!==candidate.name||selected?.locator!==candidate.locator)return undefined;
    return {...candidate,content:match[2].trimStart()};
  }};
}
