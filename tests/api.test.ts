import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Ledger } from '../server/ledger.ts';
import { createApp } from '../server/app.ts';
import { OpenAIProvider } from '../server/provider.ts';
import { intentSchema } from '../shared/contracts.ts';
const config={transcriptionModel:'gpt-transcribe',intentModel:'gpt-4.1-mini',timeout:100};
test('HTTP confirmation, concurrent retries, schema boundary and origin protections',async()=>{
  const ledger=new Ledger(':memory:'),server=createApp(ledger,new OpenAIProvider(config)).listen(0,'127.0.0.1');
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
  }finally{await new Promise<void>(r=>server.close(()=>r()));ledger.close();}
});
test('real-provider adapter contract: multipart audio and strict intent (mock transport, no live API)',async()=>{
  const calls:{url:string;init:RequestInit}[]=[];
  const transport=(async(url:unknown,init:RequestInit)=>{calls.push({url:String(url),init});if(String(url).endsWith('transcriptions'))return Response.json({text:'Suresh ko 40 udhaar likho'});return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({intent:'ADD_CREDIT',customerQuery:'Suresh',amount:'40',missingFields:[],message:null})}]}]});}) as typeof fetch;
  const provider=new OpenAIProvider({...config,key:'test-key-not-real'},transport);
  assert.equal(await provider.transcribe(Buffer.alloc(30),'audio/webm'),'Suresh ko 40 udhaar likho');
  const intent=await provider.interpret('Suresh ko 40 udhaar likho',null);assert.equal(intent.intent,'ADD_CREDIT');
  assert(calls[0].init.body instanceof FormData);assert.equal((calls[0].init.body as FormData).get('model'),config.transcriptionModel);
  const body=JSON.parse(calls[1].init.body as string);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.tools,undefined);
});
test('provider errors, timeout, refusal and malformed output are sanitized',async()=>{
  for(const transport of [async()=>new Response('sensitive-key',{status:401}),async()=>{throw new Error('secret-key');},async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]}),async()=>Response.json({status:'incomplete'})]){
    const p=new OpenAIProvider({...config,key:'secret-key'},transport as typeof fetch);
    await assert.rejects(p.interpret('hello',null),e=>e instanceof Error&&!e.message.includes('secret-key')&&!e.message.includes('sensitive'));
  }
  assert.throws(()=>intentSchema.parse({intent:'EXECUTE_SQL',sql:'DROP TABLE customers'}));
  assert.throws(()=>intentSchema.parse({intent:'ADD_CREDIT',customerQuery:'Suresh',amount:'40',missingFields:[],message:null,confirmed:true}));
});
