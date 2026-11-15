import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DomainError} from './money.ts';

export interface SpeechEngine {
  readonly configured:boolean;
  readonly name:string;
  readonly config:{transcriptionModel:string;intentModel:string};
  transcribe(bytes:Buffer,mime:string,signal?:AbortSignal):Promise<string>;
  close?():void;
}
type Config={python?:string;modelPath?:string;timeout?:number;enabled?:boolean};
export class LocalSpeechAgent implements SpeechEngine {
  readonly name='Local Whisper';
  readonly config={transcriptionModel:'Whisper base · CPU int8',intentModel:'BOL local rule agents'};
  private python:string;private modelPath:string;private timeout:number;private enabled:boolean;
  private child:ChildProcessWithoutNullStreams|null=null;
  private loading:Promise<void>|null=null;
  private busy=false;
  private active:{id:string;resolve:(value:string)=>void;reject:(e:Error)=>void}|null=null;
  constructor(config:Config={}){
    this.python=resolve(config.python??(process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python'));
    this.modelPath=resolve(config.modelPath??'models/whisper-base');this.timeout=config.timeout??120000;this.enabled=config.enabled??true;
  }
  get configured(){return this.enabled&&existsSync(this.python)&&['model.bin','config.json','tokenizer.json'].every(f=>existsSync(resolve(this.modelPath,f)));}
  private start():Promise<void>{
    if(this.loading)return this.loading;
    this.loading=new Promise((ready,fail)=>{
      let settled=false;
      const child=spawn(this.python,['-u',resolve('local-ai/speech_worker.py'),this.modelPath],{windowsHide:true,stdio:'pipe',env:{...process.env,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',DO_NOT_TRACK:'1'}});
      this.child=child;
      const deadline=setTimeout(()=>{fail(new DomainError('LOCAL_TIMEOUT','Loading the local speech model timed out. Try again.',503));this.close();},this.timeout);
      child.stderr.on('data',()=>{}); // Never forward audio, transcripts, user input or stack traces into logs.
      createInterface({input:child.stdout}).on('line',line=>{
        try{
          const result=JSON.parse(line);
          if('ready' in result){clearTimeout(deadline);settled=true;if(result.ready)ready();else fail(new DomainError('LOCAL_MODEL_ERROR','The local speech model could not load. Run npm run setup:local again.',503));return;}
          const active=this.active;if(!active||result.id!==active.id)return;
          if(result.ok&&typeof result.transcript==='string'&&result.transcript.trim()&&result.transcript.length<=2000)active.resolve(result.transcript.trim());
          else active.reject(new DomainError(result.code??'LOCAL_AUDIO_ERROR',result.code==='NO_SPEECH'?'No speech was detected. Try again or type your entry.':result.code==='AUDIO_TOO_LONG'?'Keep recordings under 20 seconds.':'The local speech agent could not decode this recording. Try again or use manual entry.',422));
        }catch{this.active?.reject(new DomainError('LOCAL_PROTOCOL','Local speech returned an invalid response.',502));}
      });
      const died=()=>{clearTimeout(deadline);if(!settled)fail(new DomainError('LOCAL_WORKER','The local speech worker could not start. Run npm run setup:local.',503));if(this.child===child){this.active?.reject(new DomainError('LOCAL_WORKER','The local speech worker stopped. Your ledger has not changed.',503));this.child=null;this.loading=null;}};
      child.on('error',died);child.on('exit',died);
    });
    return this.loading;
  }
  async transcribe(bytes:Buffer,_mime:string,signal?:AbortSignal):Promise<string>{
    if(!this.configured)throw new DomainError('VOICE_NOT_CONFIGURED','Install the local speech model: npm run setup:local. No API key is required.',503);
    if(this.busy)throw new DomainError('LOCAL_BUSY','The local speech agent is busy. Wait for the current recording.',503);
    this.busy=true;
    let rejectAbort:((error:Error)=>void)|undefined;
    const abort=()=>{rejectAbort?.(new DomainError('LOCAL_CANCELLED','Recording request cancelled.',499));this.close();};
    const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
    const deadline=setTimeout(()=>{rejectAbort?.(new DomainError('LOCAL_TIMEOUT','Local speech took too long. Try a shorter recording or use manual entry.',503));this.close();},this.timeout);
    signal?.addEventListener('abort',abort,{once:true});
    try{
      if(signal?.aborted)throw new DomainError('LOCAL_CANCELLED','Recording request cancelled.',499);
      await Promise.race([this.start(),aborted]);
      return await Promise.race([new Promise<string>((ok,fail)=>{const id=randomUUID();this.active={id,resolve:ok,reject:fail};this.child!.stdin.write(JSON.stringify({id,audio:bytes.toString('base64')})+'\n',error=>{if(error)fail(new DomainError('LOCAL_WORKER','The local speech worker is unavailable.',503));});}),aborted]);
    }finally{clearTimeout(deadline);signal?.removeEventListener('abort',abort);this.active=null;this.busy=false;}
  }
  close(){const child=this.child;this.child=null;this.loading=null;this.active?.reject(new DomainError('LOCAL_CANCELLED','The local speech worker was stopped.',499));child?.kill();}
}
