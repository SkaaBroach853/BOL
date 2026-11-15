import 'dotenv/config';
import { resolve } from 'node:path';
import express from 'express';
import { Ledger } from './ledger.ts';
import { createApp } from './app.ts';
import { LocalSpeechAgent } from './local-speech.ts';

const host=process.env.HOST??'127.0.0.1';
if(!['127.0.0.1','localhost','::1'].includes(host)) throw new Error('Local prototype: HOST must be a loopback address.');
function positive(name:string,fallback:number){const n=Number(process.env[name]??fallback);if(!Number.isSafeInteger(n)||n<1)throw new Error(`Invalid ${name}`);return n;}
const ledger=new Ledger(process.env.DATABASE_PATH??'./data/bol.sqlite',positive('ENTRY_LIMIT_PAISE',1_000_000),positive('PROPOSAL_TTL_SECONDS',300));
const provider=new LocalSpeechAgent({python:process.env.LOCAL_PYTHON,modelPath:process.env.LOCAL_WHISPER_MODEL,timeout:positive('LOCAL_SPEECH_TIMEOUT_MS',120000),enabled:process.env.BOL_DISABLE_LOCAL_SPEECH!=='1'});
const app=createApp(ledger,provider);
let vite:Awaited<ReturnType<typeof import('vite')['createServer']>>|undefined;
if(process.argv.includes('--production')) {app.use(express.static(resolve('dist'),{index:false}));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}
else { const {createServer}=await import('vite');vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares); }
const server=app.listen(positive('PORT',3000),host,()=>console.log(`BOL ready: http://${host}:${process.env.PORT??3000} · SQLite · voice ${provider.configured?'local model installed':'setup needed (npm run setup:local)'}`));
async function stop(){server.close();provider.close();await vite?.close();ledger.close();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
