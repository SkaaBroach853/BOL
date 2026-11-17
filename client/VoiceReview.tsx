import {useEffect,useRef,useState} from 'react';
import {Mic,Square,RotateCcw} from 'lucide-react';
import {api} from './api';
import {monitorMicrophone,type MicrophoneMeter} from './microphone';
import {reviewCommand} from '../shared/language';
export function VoiceReview({proposalId,onConfirm,onRetry,onCancel}:{proposalId:string;onConfirm:()=>void;onRetry:()=>void;onCancel:()=>void}){
 const [state,setState]=useState<'ready'|'listening'|'processing'|'error'>('ready'),[note,setNote]=useState('Opening the follow-up microphone…'),[heard,setHeard]=useState('');
 const recorder=useRef<MediaRecorder|null>(null),meter=useRef<MicrophoneMeter|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),controller=useRef<AbortController|null>(null),revision=useRef(0);
 const callbacks=useRef({onConfirm,onRetry,onCancel});callbacks.current={onConfirm,onRetry,onCancel};
 function cleanup(){revision.current++;controller.current?.abort();if(timer.current)clearTimeout(timer.current);if(recorder.current?.state==='recording'){recorder.current.onstop=null;recorder.current.stop();}meter.current?.close();meter.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;}
 function stop(){if(recorder.current?.state==='recording')recorder.current.stop();}
 async function start(){
  cleanup();const version=revision.current;controller.current=new AbortController();setHeard('');setState('ready');setNote('Opening the follow-up microphone…');
  try{
   if(document.hidden)throw new Error('Return to this tab and tap Listen for confirmation.');
   const media=await navigator.mediaDevices.getUserMedia({audio:true});if(version!==revision.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;
   const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error('This browser cannot record the follow-up. Use the confirmation button.');
   const r=new MediaRecorder(media,{mimeType:mime}),chunks:BlobPart[]=[];recorder.current=r;r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   meter.current=await monitorMicrophone(media,stop);if(version!==revision.current){meter.current.close();media.getTracks().forEach(t=>t.stop());return;}
   r.onerror=()=>{if(version===revision.current){cleanup();setState('error');setNote('Recording failed. Use the confirmation button or listen again.');}};
   r.onstop=async()=>{
    if(timer.current)clearTimeout(timer.current);const detected=meter.current?.hasSpeech();meter.current?.close();meter.current=null;media.getTracks().forEach(t=>t.stop());stream.current=null;
    if(version!==revision.current)return;
    if(!detected){setState('ready');setNote('No speech detected. Tap to listen again, or use the buttons.');return;}
    setState('processing');setNote('Checking your confirmation on this computer…');
    try{const result=await api<{transcript:string}>('/transcribe',new Blob(chunks,{type:mime}),{raw:true,mime,signal:controller.current!.signal});if(version!==revision.current||document.hidden)return;setHeard(result.transcript);const command=reviewCommand(result.transcript);
     if(command==='confirm'){cleanup();callbacks.current.onConfirm();}
     else if(command==='retry'){cleanup();callbacks.current.onRetry();}
     else if(command==='cancel'){cleanup();callbacks.current.onCancel();}
     else{setState('ready');setNote('No confirmation recognized. Nothing was saved. Try the exact phrase below or use the buttons.');}
    }catch(e){if(version===revision.current){setState('error');setNote((e as Error).message);}}
   };
   r.start();setState('listening');setNote('Listening for your decision. Say “sahi hai, confirm” or “phir se suno”.');timer.current=setTimeout(stop,8000);
  }catch(e){if(version===revision.current){cleanup();setState('error');setNote((e as Error).message);}}
 }
 useEffect(()=>{const startTimer=setTimeout(()=>void start(),650);const hide=()=>{if(document.hidden){cleanup();setState('ready');setNote('Listening paused. Return and tap to listen again.');}};document.addEventListener('visibilitychange',hide);return()=>{clearTimeout(startTimer);document.removeEventListener('visibilitychange',hide);cleanup();};},[proposalId]);
 return <section className={'voice-review '+(state==='listening'?'listening':'')} aria-label="Voice confirmation"><div><Mic size={17}/><strong>{state==='listening'?'I’m listening for your decision':state==='processing'?'Understanding your decision':'Confirm with your voice'}</strong></div><p role="status">{note}</p>{heard&&<p className="command-heard">Heard: {heard}</p>}<button className="secondary full" disabled={state==='processing'} onClick={()=>state==='listening'?stop():void start()}>{state==='listening'?<Square size={15}/>:<RotateCcw size={15}/>} {state==='listening'?'Stop follow-up recording':'Listen for confirmation'}</button><small>Only an explicit confirmation of this visible preview can save it.</small></section>;
}
