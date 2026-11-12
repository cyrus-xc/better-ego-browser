const test=require('node:test');
const assert=require('node:assert/strict');
const {createRequire,registerHooks}=require('node:module');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');

// Run with the DSH Electron Node runtime and its package.json as DSH_TEST_SDK_MANIFEST.
test('runtime browser instructions survive official shared Skill discovery and unload cleanly',{
  skip:!process.env.DSH_TEST_SDK_MANIFEST&&'Set DSH_TEST_SDK_MANIFEST to run against the real DSH registry',
},async()=>{
  const req=createRequire(process.env.DSH_TEST_SDK_MANIFEST);
  const load=name=>import(pathToFileURL(req.resolve(name)).href);
  const mcp=pathToFileURL(req.resolve('@deepseek-ai/dsh-mcp-client')).href;
  const hook=registerHooks({resolve(s,c,n){return n(s==='@deepseek-ai/dsh-mcp-client'?mcp:s,c);}});
  const {Context}=await load('@deepseek-ai/cordis');
  const {SkillRegistry,renderSkillContent}=await load('@deepseek-ai/dsh-skill');
  const {createScope,scopeTarget}=await load('@deepseek-ai/dsh-scope');
  const {FileSystemSkillProvider}=await load('@deepseek-ai/dsh-skill-filesystem');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ego-skill-regression-'));
  const agentsHome=path.join(root,'home','.agents'),dshHome=path.join(root,'home','.dsh');
  const workspace=path.join(root,'workspace');
  await fs.mkdir(path.join(workspace,'.git'),{recursive:true});
  const official=path.join(agentsHome,'skills','ego-browser','SKILL.md');
  const original='---\nname: ego-browser\ndescription: Official browser CLI bootstrap.\n---\nRun ego-browser skill, write round.mjs, then execute the official CLI.\n';
  await fs.mkdir(path.dirname(official),{recursive:true});
  await fs.writeFile(official,original);
  const world=new Context(),cleanup=[],tools=new Map();
  const skillHost=world.plugin(SkillRegistry);await skillHost;
  const registry=world.skills;
  const presetOwner=world.plugin({name:'preset-owner',inject:['skills'],apply(){}});await presetOwner;
  const agentOwner=world.plugin({name:'session-owner',apply(){}});await agentOwner;
  const preset={},agent={id:'existing-agent'};
  const presetMount=createScope(presetOwner.ctx,preset);
  const agentMount=createScope(agentOwner.ctx,agent,{parent:preset});agent.ctx=agentMount.ctx;
  assert.throws(()=>agent.ctx.skills,/cannot get property .*skills.* without inject/);
  const skills={register(skill){const dispose=registry.register(skill);cleanup.push(dispose);return dispose;},registerProvider(factory){const dispose=registry.registerProvider(factory);cleanup.push(dispose);return dispose;}};
  let filesystem;
  const removeFilesystem=presetMount.ctx.skills.registerProvider(control=>filesystem=new FileSystemSkillProvider(presetMount.ctx,control,{agentsHome,dshHome,watch:false}));
  const {apply}=await import('../dsh/plugin.mjs');
  try{
    const lookup={cwd:workspace,scope:agent};
    assert.equal((await registry.get('ego-browser',lookup)).provider,'filesystem');
    await apply({get(){},skills,agents:{list(){return[agent]}},on(...args){return world.on(...args)},effect(f){const d=f();if(d)cleanup.push(d);return d;},tools:{register(def){tools.set(def.name,def);return()=>tools.delete(def.name);}}});
    for(let i=0;i<2;i++){
      const selected=await registry.get('ego-browser',lookup);
      assert.equal(selected.provider,'ego');
      const rendered=renderSkillContent(selected);
      assert.match(rendered,/ego_loopback_browser/);
      assert.doesNotMatch(rendered,/Run ego-browser skill|write round\.mjs/);
      assert.equal(selected.path,undefined);
      if(i===0){await fs.writeFile(official,original+'Official update.\n');registry.invalidateCache();}
    }
    const future={id:'future-agent'};
    const futureMount=createScope(agentOwner.ctx,future,{parent:preset});future.ctx=futureMount.ctx;
    try{
      await world.serial(scopeTarget(future,future),'agent/created',{agent:future});
      assert.equal((await registry.get('ego-browser',{cwd:workspace,scope:future})).provider,'ego');
      assert.ok(tools.has('ego_loopback_browser'));
    }finally{await futureMount.dispose();}
    for(const dispose of cleanup.splice(0).reverse())await dispose();
    assert.equal(tools.size,0);
    assert.equal((await registry.get('ego-browser',lookup)).provider,'filesystem');
    assert.equal(await fs.readFile(official,'utf8'),original+'Official update.\n');
  }finally{
    for(const dispose of cleanup.reverse())await dispose();
    removeFilesystem();await filesystem.dispose();await agentMount.dispose();await presetMount.dispose();await agentOwner.dispose();await presetOwner.dispose();await skillHost.dispose();hook.deregister();
    await fs.rm(root,{recursive:true,force:true});
  }
});
