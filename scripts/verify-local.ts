import {spawn} from 'node:child_process';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {LocalSpeechAgent} from '../server/local-speech.ts';
import {Ledger} from '../server/ledger.ts';
import {createApp} from '../server/app.ts';

const file='data/local-speech-smoke.wav';
if(!existsSync(file)){
  if(process.platform!=='win32')throw new Error('Generate a <=20s WAV saying Suresh credit forty rupees at data/local-speech-smoke.wav.');
  await new Promise<void>((ok,fail)=>{const child=spawn('powershell.exe',['-NoProfile','-File','local-ai/make-test-audio.ps1'],{stdio:'inherit',windowsHide:true});child.once('error',fail);child.once('exit',code=>code===0?ok():fail(new Error('Local system TTS was unavailable.')));});
}
const speech=new LocalSpeechAgent(),ledger=new Ledger(':memory:');
assert.equal(speech.configured,true,'Run npm run setup:local first.');
const server=createApp(ledger,speech).listen(0,'127.0.0.1');
await new Promise<void>(ok=>server.once('listening',ok));
const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
try{
  const health=await(await fetch(base+'/api/health')).json();
  const headers={'x-bol-csrf':health.csrfToken,'Content-Type':'application/json'};
  assert.equal(health.cloudRequests,false);
  const start=performance.now();
  const response=await fetch(base+'/api/transcribe',{method:'POST',headers:{...headers,'Content-Type':'audio/wav'},body:readFileSync(file),signal:AbortSignal.timeout(120000)});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));
  const interpreted=await(await fetch(base+'/api/interpret',{method:'POST',headers,body:JSON.stringify({transcript:result.transcript,targetId:null,inputType:'voice'})})).json();
  const elapsedMs=Math.round(performance.now()-start);
  assert.equal(interpreted.kind,'preview',JSON.stringify(interpreted));
  assert.equal(interpreted.proposal.name,'Suresh');assert.equal(interpreted.proposal.amount,4000);assert.equal(interpreted.proposal.action,'ADD_CREDIT');
  assert.equal(ledger.snapshot().total,0,'Speech and agents cannot save money without confirmation.');
  const saved=await(await fetch(base+`/api/proposals/${interpreted.proposal.id}/confirm`,{method:'POST',headers,body:JSON.stringify({operationId:randomUUID()})})).json();
  assert.equal(saved.balances[0].balance,4000);
  const evidence={date:new Date().toISOString(),engine:'faster-whisper 1.2.1 / Whisper base / CPU int8',input:'Windows offline system TTS, synthetic English speech; not a human Hindi sample',spokenText:'Suresh credit forty rupees.',observedTranscript:result.transcript,observedAction:interpreted.proposal.action,observedAmountPaise:interpreted.proposal.amount,stopToPreviewEquivalentMs:elapsedMs,cloudRequests:false,assertions:'HTTP upload → real local transcription → local agents → preview has zero balance effect → explicit confirmation saves ₹40',sampleSize:1};
  writeFileSync('docs/local-speech-verification.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{speech.close();await new Promise<void>(ok=>server.close(()=>ok()));ledger.close();}
