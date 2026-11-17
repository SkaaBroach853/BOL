import express, {type ErrorRequestHandler} from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { idSchema } from '../shared/contracts.ts';
import { Ledger } from './ledger.ts';
import { DomainError } from './money.ts';
import { LedgerAgents } from './agents.ts';
import type { SpeechEngine } from './local-speech.ts';
import {normalizePhone} from '../shared/contacts.ts';
const phoneSchema=z.string().max(30).transform((value,ctx)=>{try{return normalizePhone(value);}catch(e){ctx.addIssue({code:'custom',message:(e as Error).message});return z.NEVER;}});

export function createApp(ledger:Ledger,provider:SpeechEngine) {
  const agents=new LedgerAgents(ledger);
  const app=express(),csrfToken=randomBytes(32).toString('hex');
  app.disable('x-powered-by');
  app.use((req,res,next)=>{
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'microphone=(self)','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:; font-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'"});
    const hostname=req.hostname;
    if(!['127.0.0.1','localhost','[::1]','::1'].includes(hostname)) return res.status(403).json({code:'LOCAL_ONLY',message:'This prototype only accepts localhost requests.'});
    if(req.path.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method)) {
      if(req.get('origin')&&new URL(req.get('origin')!).host!==req.get('host')) return res.status(403).json({code:'ORIGIN',message:'Use the same local app tab.'});
      if(req.get('x-bol-csrf')!==csrfToken) return res.status(403).json({code:'CSRF',message:'The server session changed. Refresh the page and retry.'});
    }
    next();
  });
  const buckets=new Map<string,{start:number;count:number}>();
  app.use('/api',(req,res,next)=>{
    if(req.method==='GET') return next();
    const key=(req.ip??'local')+(req.path==='/transcribe'||req.path==='/interpret'?':voice':':write');
    const limit=key.endsWith(':voice')?30:120,at=Date.now(),bucket=buckets.get(key);
    if(!bucket||at-bucket.start>60_000) buckets.set(key,{start:at,count:1});
    else if(++bucket.count>limit) return res.status(429).json({code:'RATE_LIMIT',message:'Too many requests. Wait a minute and try again.'});
    next();
  });
  app.use(express.json({limit:'16kb'}));
  app.get('/api/health',(_req,res)=>res.json({ok:true,voiceConfigured:provider.configured,provider:provider.name,transcriptionModel:provider.config.transcriptionModel,intentModel:provider.config.intentModel,entryLimit:ledger.limit,shopId:ledger.shopId,shopName:'Corner Chai',csrfToken,mode:'local',cloudRequests:false}));
  app.get('/api/snapshot',(_req,res)=>res.json(ledger.snapshot()));
  app.get('/api/customers',(_req,res)=>res.json(ledger.customers()));
  app.post('/api/customers',(req,res)=>{
    const b=z.object({name:z.string().trim().min(1).max(80),label:z.string().trim().max(80),operationId:idSchema,phone:phoneSchema.optional()}).strict().parse(req.body);
    res.status(201).json(ledger.addCustomer(b.name,b.label,b.operationId,b.phone));
  });
  app.post('/api/customers/:id/phone',(req,res)=>{const b=z.object({phone:phoneSchema}).strict().parse(req.body);res.json(ledger.updatePhone(idSchema.parse(req.params.id),b.phone));});
  app.get('/api/customers/:id/ledger',(req,res)=>{const id=idSchema.parse(req.params.id);res.json({customer:ledger.customer(id),entries:ledger.entries(id)});});
  app.get('/api/activity',(_req,res)=>res.json(ledger.entries()));
  app.post('/api/proposals',(req,res)=>res.status(201).json(ledger.propose(req.body)));
  app.post('/api/proposals/:id/confirm',(req,res)=>{const b=z.object({operationId:idSchema}).strict().parse(req.body);res.json(ledger.confirm(idSchema.parse(req.params.id),b.operationId));});
  app.post('/api/proposals/:id/cancel',(req,res)=>{z.object({}).strict().parse(req.body);ledger.cancel(idSchema.parse(req.params.id));res.json({ok:true});});
  app.get('/api/operations/:id',(req,res)=>{const receipt=ledger.recover(idSchema.parse(req.params.id));res.status(receipt?200:404).json(receipt??{code:'NOT_FOUND',message:'No saved receipt for this operation yet.'});});
  app.post('/api/demo/reset',(req,res)=>{const b=z.object({phrase:z.string()}).strict().parse(req.body);res.json({shopId:ledger.reset(b.phrase)});});
  app.post('/api/transcribe',express.raw({type:['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg'],limit:'5mb'}),async(req,res)=>{
    const mime=req.get('content-type')?.split(';')[0]??'';
    if(!Buffer.isBuffer(req.body)||req.body.length<16) throw new DomainError('INVALID_AUDIO','Record a short supported audio clip (WebM, Ogg, MP4, WAV).',415);
    const bytes=req.body as Buffer,head=bytes.subarray(0,12);
    const valid=mime==='audio/webm'?head[0]===0x1a&&head[1]===0x45:mime==='audio/ogg'?head.toString('ascii',0,4)==='OggS':mime==='audio/wav'?head.toString('ascii',0,4)==='RIFF':mime==='audio/mp4'?head.toString('ascii',4,8)==='ftyp':mime==='audio/mpeg';
    if(!valid) throw new DomainError('INVALID_AUDIO','The audio contents do not match the recording format.',415);
    const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded) controller.abort();});
    const start=performance.now(),transcript=await provider.transcribe(bytes,mime,controller.signal);
    res.json({transcript,elapsedMs:Math.round(performance.now()-start),source:'local-whisper'});
  });
  app.post('/api/interpret',async(req,res)=>{
    const b=z.object({transcript:z.string().trim().min(1).max(2000),targetId:idSchema.nullable(),inputType:z.enum(['typed','voice'])}).strict().parse(req.body);
    const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
    const target=ledger.latest();
    // The client carries the last ledger action seen when the request began; a stale target never advances automatically.
    if(b.targetId&&target?.id!==b.targetId) throw new DomainError('STALE_TARGET','The ledger changed. Refresh and review the latest entry.',409);
    if(b.inputType==='voice'&&!provider.configured) throw new DomainError('VOICE_NOT_CONFIGURED','Voice is not configured. Use manual or typed input.',503);
    const start=performance.now();
    if(controller.signal.aborted) return;
    res.json({...agents.run(b.transcript,b.targetId,b.inputType),elapsedMs:Math.round(performance.now()-start)});
  });
  app.use('/api',(_req,res)=>res.status(404).json({code:'NOT_FOUND',message:'API route not found.'}));
  const errors:ErrorRequestHandler=(error,_req,res,_next)=>{
    if(error instanceof DomainError) return void res.status(error.status).json({code:error.code,message:error.message});
    if(error instanceof z.ZodError) return void res.status(400).json({code:'VALIDATION',message:'Review the request fields. A customer, valid action, and amount may be required.'});
    if(error.type==='entity.too.large') return void res.status(413).json({code:'TOO_LARGE',message:'This recording or request is too large. Record up to 20 seconds.'});
    if(error instanceof SyntaxError) return void res.status(400).json({code:'INVALID_JSON',message:'Invalid request format.'});
    console.error('Request failed:',error.code??error.name??'internal');
    res.status(500).json({code:'INTERNAL',message:'The request failed. Check the ledger before retrying; reuse the same operation.'});
  };
  app.use(errors);
  return app;
}
