import test from 'node:test';
import assert from 'node:assert/strict';
import {startBridge,requestBridge,validate} from '../dsh/loopback/server.mjs';
test('loopback rejects unauthenticated, browser-origin and foreign-space requests',async()=>{
  let invoked=0;
  const bridge=await startBridge({run:async request=>{invoked++;return request.action==='create'?{spaceId:7}:request.action==='spaces'?{coverage:'recent-tab-titles',spaces:[{id:0,recentTabTitles:['Example']}]}:{finished:true};}});
  try {
    assert.equal((await fetch(bridge.endpoint,{method:'POST',body:'{}'})).status,401);
    assert.equal((await fetch(bridge.endpoint,{method:'POST',headers:{Origin:'https://example.com',Authorization:'Bearer '+bridge.token},body:'{}'})).status,403);
    await assert.rejects(requestBridge(bridge,{action:'snapshot',spaceId:123}),/does not own/);
    assert.equal(invoked,0);
    const health=await requestBridge(bridge,{action:'health'});
    assert.deepEqual(health.ownedSpaces,[]);
    assert.equal(health.browserInventory,'use-spaces-action');
    assert.equal(Object.hasOwn(health,'activeSpaces'),false);
    const spaces=await requestBridge(bridge,{action:'spaces'});
    assert.deepEqual(spaces,{coverage:'recent-tab-titles',spaces:[{id:0,recentTabTitles:['Example']}]});
    assert.equal(invoked,1);
    assert.equal((await requestBridge(bridge,{action:'create',name:'test'})).spaceId,7);
    await requestBridge(bridge,{action:'finish',spaceId:7});
    await assert.rejects(requestBridge(bridge,{action:'snapshot',spaceId:7}),/does not own/);
    assert.equal(invoked,3);
  }finally{await bridge.close();}
});
test('requests allow only fixed browser operations and treat text as data',()=>{
  for(const action of ['eval','run_js','shell','exec']) assert.throws(()=>validate({action}));
  for(const url of ['file:///C:/Windows/win.ini','javascript:alert(1)','http://user:pass@example.com']) assert.throws(()=>validate({action:'navigate',spaceId:7,url}));
  const text='中文 "); import("node:fs"); //';
  assert.equal(validate({action:'fill',spaceId:7,selector:'#x',text,artifactPath:'D:/bad'}).text,text);
  assert.equal(validate({action:'fill',spaceId:7,selector:'#x',text,artifactPath:'D:/bad'}).artifactPath,undefined);
});
test('native operations are serialized across HTTP clients',async()=>{
  let active=0,max=0,count=0;
  const bridge=await startBridge({run:async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,10));active--;return{spaceId:++count};}});
  try{await Promise.all([requestBridge(bridge,{action:'create',name:'a'}),requestBridge(bridge,{action:'create',name:'b'})]);assert.equal(max,1);}finally{await bridge.close();}
});
