import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import express from 'express';
import {chromium,expect,type Page} from '@playwright/test';
import {LocalSpeechAgent} from '../server/local-speech.ts';
import {Ledger} from '../server/ledger.ts';
import {createApp} from '../server/app.ts';

// Real ASR and API. Only the microphone source is synthetic, with recorded Windows offline TTS.
for(const [text,file] of [['Suresh credit forty rupees.','data/local-speech-smoke.wav'],['Listen again.','data/local-retry.wav'],['Confirm.','data/local-confirm.wav']]){
 if(existsSync(file)&&readFileSync(file).length>100)continue;
 await new Promise<void>((ok,fail)=>{const child=spawn('powershell.exe',['-NoProfile','-File','local-ai/make-test-audio.ps1','-Text',text,'-Output',file],{stdio:'inherit',windowsHide:true});child.once('error',fail);child.once('exit',code=>code===0?ok():fail(new Error('Offline Windows TTS unavailable.')));});
}
const clips=['data/local-speech-smoke.wav','data/local-retry.wav','data/local-speech-smoke.wav','data/local-confirm.wav'].map(p=>readFileSync(p).toString('base64'));
const speech=new LocalSpeechAgent(),ledger=new Ledger(':memory:');
if(!speech.configured)throw new Error('Run npm run setup:local first.');
const app=createApp(ledger,speech);app.use(express.static(resolve('dist')));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(ok=>server.once('listening',ok));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
let diagnosticPage:Page|undefined;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),observations:{transcript:string;elapsedMs:number}[]=[];
 diagnosticPage=page;page.on('pageerror',e=>console.error('Browser error:',e.message));
 page.on('response',async r=>{if(r.url().endsWith('/api/transcribe')&&r.ok())observations.push(await r.json());});
 await page.addInitScript({content:`
  const clips=${JSON.stringify(clips)};window.__clip=0;
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   const index=window.__clip++,audio=new AudioContext();await audio.resume();
   const dest=audio.createMediaStreamDestination(),source=audio.createBufferSource();
   const bytes=Uint8Array.from(atob(clips[Math.min(index,clips.length-1)]),c=>c.charCodeAt(0));source.buffer=await audio.decodeAudioData(bytes.buffer);source.connect(dest);source.start(audio.currentTime+.45);source.onended=()=>source.disconnect();
   const track=dest.stream.getAudioTracks()[0],stop=track.stop.bind(track);track.stop=()=>{stop();void audio.close();};return dest.stream;
  }});
 `});
 await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}`);await expect(page.getByText('Local ledger connected',{exact:true})).toBeVisible();
 mkdirSync('docs/screenshots',{recursive:true});
 await page.getByRole('button',{name:'Start voice recording',exact:true}).click();
 await expect(page.locator('canvas[data-signal="active"]')).toBeVisible({timeout:10000});await page.screenshot({path:'docs/screenshots/studio-real-voice-recording.png',fullPage:true});
 await expect(page.getByText('Transcribing on this computer',{exact:false})).toBeVisible({timeout:15000});await page.screenshot({path:'docs/screenshots/studio-real-voice-processing.png',fullPage:true});
 await expect(page.getByRole('heading',{name:'Credit added',exact:true})).toBeVisible({timeout:120000});expect(ledger.snapshot().total).toBe(0);
 const first=await page.getByLabel('Editable transcript').inputValue();await page.screenshot({path:'docs/screenshots/studio-real-voice-preview.png',fullPage:true});
 // The second real recording says Listen again; cancellation must not save anything.
 await expect.poll(()=>page.evaluate(()=>(window as any).__clip),{timeout:45000}).toBeGreaterThanOrEqual(3);expect(ledger.entries()).toHaveLength(0);
 // The third real recording repeats the credit, then the fourth explicitly says Confirm.
 await expect(page.getByText('Saved to SQLite',{exact:true})).toBeVisible({timeout:120000});
 await page.getByRole('checkbox',{name:/Voice conversation/}).uncheck();expect(ledger.snapshot().total).toBe(4000);expect(ledger.entries()).toHaveLength(1);
 await page.screenshot({path:'docs/screenshots/studio-real-voice-receipt.png',fullPage:true});
 const evidence={date:new Date().toISOString(),browser:'Installed Microsoft Edge headless / Windows',engine:'faster-whisper / base / CPU int8',input:'Four Windows offline TTS English clips fed through real AudioContext streams and MediaRecorder; not human speech',mockedAPI:false,firstTranscript:first,observations,assertions:['Actual waveform becomes active from audio samples','Recording stops after detected pause','Real ASR generates credit preview, ledger remains zero','Real spoken Listen again cancels and starts new capture without saving','Second credit preview followed by real spoken Confirm saves once','Final ledger exactly 4000 paise, one event'],limitations:['Human Hindi and noise unverified','Microphone hardware and OS permission prompt not exercised','No claim of universal phrase recognition']};
 writeFileSync('docs/voice-ui-verification.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}catch(e){if(diagnosticPage){await diagnosticPage.screenshot({path:'docs/screenshots/voice-ui-failure.png',fullPage:true});console.error((await diagnosticPage.locator('body').innerText()).slice(0,5000));}throw e;}finally{await browser.close();speech.close();await new Promise<void>(ok=>server.close(()=>ok()));ledger.close();}
