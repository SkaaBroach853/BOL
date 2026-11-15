import 'dotenv/config';
import { resolve } from 'node:path';
import express from 'express';
import { Ledger } from './ledger.ts';
import { createApp } from './app.ts';
import { OpenAIProvider } from './provider.ts';

const host=process.env.HOST??'127.0.0.1';
if(!['127.0.0.1','localhost','::1'].includes(host)) throw new Error('Local prototype: HOST must be a loopback address.');
function positive(name:string,fallback:number){const n=Number(process.env[name]??fallback);if(!Number.isSafeInteger(n)||n<1)throw new Error(`Invalid ${name}`);return n;}
if(process.env.VOICE_PROVIDER&&process.env.VOICE_PROVIDER!=='openai') throw new Error('VOICE_PROVIDER must be openai.');
const ledger=new Ledger(process.env.DATABASE_PATH??'./data/bol.sqlite',positive('ENTRY_LIMIT_PAISE',1_000_000),positive('PROPOSAL_TTL_SECONDS',300));
const provider=new OpenAIProvider({key:process.env.OPENAI_API_KEY,transcriptionModel:process.env.OPENAI_TRANSCRIBE_MODEL??'gpt-transcribe',intentModel:process.env.OPENAI_INTENT_MODEL??'gpt-4.1-mini',timeout:positive('PROVIDER_TIMEOUT_MS',30000)});
const app=createApp(ledger,provider);
let vite:Awaited<ReturnType<typeof import('vite')['createServer']>>|undefined;
if(process.argv.includes('--production')) {app.use(express.static(resolve('dist'),{index:false}));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}
else { const {createServer}=await import('vite');vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares); }
const server=app.listen(positive('PORT',3000),host,()=>console.log(`BOL ready: http://${host}:${process.env.PORT??3000} · SQLite · voice ${provider.configured?'configured (not yet verified)':'not configured'}`));
async function stop(){server.close();await vite?.close();ledger.close();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
