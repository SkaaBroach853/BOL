import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Ledger } from '../server/ledger.ts';
import { createApp } from '../server/app.ts';
import { LocalSpeechAgent } from '../server/local-speech.ts';
import { LedgerAgents } from '../server/agents.ts';
import { intentSchema } from '../shared/contracts.ts';

test('HTTP confirmation, concurrent retries, schema boundary and origin protections',async()=>{
  const ledger=new Ledger(':memory:'),server=createApp(ledger,new LocalSpeechAgent({enabled:false})).listen(0,'127.0.0.1');
  await new Promise<void>(r=>server.once('listening',r));const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}`;
  try{
    const h=await(await fetch(base+'/api/health')).json();const headers={'Content-Type':'application/json','x-bol-csrf':h.csrfToken};
    const post=(path:string,body:unknown)=>fetch(base+'/api'+path,{method:'POST',headers,body:JSON.stringify(body)});
    const customer=ledger.customers()[0];
    const proposal=await(await post('/proposals',{action:'ADD_CREDIT',customerId:customer.id,amount:'40'})).json();
    const operationId=randomUUID();
    const results=await Promise.all(Array.from({length:8},()=>post('/proposals/'+proposal.id+'/confirm',{operationId}).then(r=>r.json())));
    assert(results.every(r=>r.id===results[0].id));assert.equal(ledger.customer(customer.id).balance,4000);assert.equal(ledger.entries().length,1);
    assert.equal((await post('/proposals',{action:'ADD_CREDIT',customerId:customer.id,amount:'40',confirmed:true})).status,400);
    assert.equal((await fetch(base+'/api/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/api/proposals',{method:'POST',headers:{...headers,origin:'https://evil.example'},body:'{}'})).status,403);
    const typed=await(await post('/interpret',{transcript:'Ramesh ko chalis diye',targetId:ledger.latest()!.id,inputType:'typed'})).json();assert.equal(typed.kind,'clarification');assert.equal(ledger.entries().length,1);
    assert.equal((await post('/interpret',{transcript:'credit',targetId:null,inputType:'voice'})).status,503);
    assert.equal((await post('/interpret',{transcript:'',targetId:null,inputType:'typed'})).status,400);
    const audio=Buffer.alloc(20);audio[0]=0x1a;audio[1]=0x45;
    const r=await fetch(base+'/api/transcribe',{method:'POST',headers:{'Content-Type':'audio/webm','x-bol-csrf':h.csrfToken},body:audio});assert.equal(r.status,503);assert.equal((await r.json()).code,'VOICE_NOT_CONFIGURED');
    assert.equal((await fetch(base+'/api/transcribe',{method:'POST',headers:{'Content-Type':'text/plain','x-bol-csrf':h.csrfToken},body:'fake audio'})).status,415);
    const saved=await(await fetch(base+'/api/operations/'+operationId)).json();assert.equal(saved.id,results[0].id);
    const added=await(await post('/customers',{name:'Kavita',label:'Tailor',phone:'9876543210',operationId:randomUUID()})).json();assert.equal(added.phone,'919876543210');
    assert.equal((await post('/customers/'+added.id+'/phone',{phone:'abc'})).status,400);
    const updated=await(await post('/customers/'+added.id+'/phone',{phone:'+91 98765 43211'})).json();assert.equal(updated.phone,'919876543211');assert.equal(updated.balance,0);assert.equal(ledger.entries().length,1);
  }finally{await new Promise<void>(r=>server.close(()=>r()));ledger.close();}
});
test('local speech has an honest missing-model error without network fallback',async()=>{
  const speech=new LocalSpeechAgent({modelPath:'models/intentionally-missing'});
  assert.equal(speech.configured,false);
  await assert.rejects(speech.transcribe(Buffer.alloc(30),'audio/webm'),/npm run setup:local/);
  speech.close();
});
test('local code agents validate intent and require confirmation before writes',()=>{
  const ledger=new Ledger(':memory:');try{
    const agents=new LedgerAgents(ledger);
    assert.equal(agents.run('Suresh credit 40',null,'voice').kind,'preview');
    assert.equal(agents.run('Ramesh ko chalis diye',null,'typed').kind,'clarification');
    assert.equal(ledger.entries().length,0);
    assert.throws(()=>intentSchema.parse({intent:'EXECUTE_SQL',sql:'DROP TABLE customers'}));
    assert.throws(()=>intentSchema.parse({intent:'ADD_CREDIT',customerQuery:'Suresh',amount:'40',missingFields:[],message:null,confirmed:true}));
  }finally{ledger.close();}
});
