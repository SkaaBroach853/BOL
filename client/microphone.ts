export type MicrophoneMeter={analyser:AnalyserNode;hasSpeech:()=>boolean;close:()=>void};

/** Reads real microphone samples. No generated levels and no audio playback. */
export async function monitorMicrophone(stream:MediaStream,onPause:()=>void):Promise<MicrophoneMeter>{
  const context=new AudioContext();
  try{
    await context.resume();
    const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();
    analyser.fftSize=1024;source.connect(analyser);
    const samples=new Float32Array(analyser.fftSize),started=performance.now();
    let frame=0,closed=false,above=0,heardSpeech=false,lastVoice=started,lastSample=0;
    function sample(now:number){
      if(closed)return;
      if(now-lastSample>=50){
        lastSample=now;analyser.getFloatTimeDomainData(samples);
        const rms=Math.sqrt(samples.reduce((sum,n)=>sum+n*n,0)/samples.length);
        if(rms>.015){above++;lastVoice=now;if(above>=3)heardSpeech=true;}else above=0;
        if(heardSpeech&&now-lastVoice>1800&&now-started>1200){onPause();return;}
      }
      frame=requestAnimationFrame(sample);
    }
    frame=requestAnimationFrame(sample);
    return {analyser,hasSpeech:()=>heardSpeech,close(){if(closed)return;closed=true;cancelAnimationFrame(frame);source.disconnect();analyser.disconnect();void context.close().catch(()=>{});}};
  }catch(error){void context.close().catch(()=>{});throw error;}
}
