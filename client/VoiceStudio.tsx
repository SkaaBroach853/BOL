import {useEffect,useRef,useState} from 'react';
import {Mic,AudioLines,ShieldCheck,BookOpen,Check,ArrowRight} from 'lucide-react';

export type StudioPhase='idle'|'permission'|'recording'|'processing'|'clarification'|'preview'|'saving'|'saved'|'error';
export type StudioStep='speech'|'intent'|'preview'|null;

export function VoiceOrb({analyser,phase}:{analyser:AnalyserNode|null;phase:StudioPhase}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current!,ctx=canvas.getContext('2d');if(!ctx)return;
    const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=340*ratio;canvas.height=230*ratio;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    const samples=new Float32Array(analyser?.fftSize??1024);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame=0,last=0;
    function draw(now:number){
      if(now-last<(reduced?125:32)){frame=requestAnimationFrame(draw);return;}last=now;
      ctx!.clearRect(0,0,340,230);
      if(analyser)analyser.getFloatTimeDomainData(samples);else samples.fill(0);
      const rms=Math.sqrt(samples.reduce((s,n)=>s+n*n,0)/samples.length);
      canvas.dataset.signal=analyser?(rms>.015?'active':'silent'):'off';
      const working=phase==='processing'&&!reduced;
      const turn=working?now*.00022:.52,reactive=reduced?0:Math.min(rms*180,21);
      // A decorative contour sphere; only actual microphone energy deforms it.
      for(let row=-13;row<=13;row++){
        const phi=row/13*Math.PI/2,ring=83*Math.cos(phi),height=83*Math.sin(phi);
        ctx!.beginPath();
        for(let n=0;n<=144;n++){
          const theta=n/144*Math.PI*2;
          const wave=analyser?samples[Math.floor(n/145*samples.length)]*reactive:0;
          const x=ring*Math.cos(theta),z=ring*Math.sin(theta),y=height;
          const xx=x*Math.cos(turn)+z*Math.sin(turn),zz=z*Math.cos(turn)-x*Math.sin(turn);
          const yy=y*.84+zz*.49;
          const px=170+xx*(1+reactive*.007)+wave*4,py=106+yy+Math.sin(theta*3+row)*reactive*.15;
          if(n===0)ctx!.moveTo(px,py);else ctx!.lineTo(px,py);
        }
        ctx!.strokeStyle=row>5?'rgba(117,134,77,.48)':'rgba(34,92,72,.57)';ctx!.lineWidth=.85;ctx!.stroke();
      }
      if(analyser){
        ctx!.beginPath();
        for(let x=0;x<200;x++){const y=214+samples[Math.floor(x/200*samples.length)]*80;if(x===0)ctx!.moveTo(70+x,y);else ctx!.lineTo(70+x,y);}
        ctx!.strokeStyle='#185d49';ctx!.lineWidth=1.4;ctx!.stroke();
      }
      if(analyser||working)frame=requestAnimationFrame(draw);
    }
    draw(performance.now());return()=>cancelAnimationFrame(frame);
  },[analyser,phase]);
  return <canvas ref={ref} className="orb-canvas" aria-hidden="true"/>;
}

export function WorkingCaption({step}:{step:StudioStep}){
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{const start=performance.now();const id=setInterval(()=>setElapsed(Math.floor((performance.now()-start)/1000)),500);return()=>clearInterval(id);},[]);
  return <span className="working-caption"><span className="working-dot"/>{step==='speech'?'Transcribing on this computer':step==='intent'?'Understanding your instruction':'Preparing your preview'}<span>{elapsed}s</span></span>;
}

export function AgentRail({phase,step,origin}:{phase:StudioPhase;step:StudioStep;origin:'voice'|'typed'|'manual'}){
  const ready=['clarification','preview','saving','saved'].includes(phase);
  const list=[
    {name:'Listen',icon:Mic,active:phase==='recording'||phase==='permission'||step==='speech'&&phase==='processing',done:origin==='voice'&&ready,text:phase==='permission'?'Allow microphone':phase==='recording'?'Microphone on':step==='speech'&&phase==='processing'?'Local transcription':origin==='voice'&&ready?'Audio understood':'Microphone off'},
    {name:'Understand',icon:AudioLines,active:phase==='processing'&&step==='intent',done:ready,text:phase==='processing'&&step==='intent'?'Reading your words':ready?origin==='manual'?'Manual entry':'Intent resolved':'Waiting for input'},
    {name:'Review',icon:ShieldCheck,active:phase==='clarification'||phase==='preview'||phase==='processing'&&step==='preview',done:phase==='saving'||phase==='saved',text:phase==='clarification'?'Needs your input':phase==='preview'?'Your confirmation':phase==='processing'&&step==='preview'?'Preparing preview':phase==='saving'||phase==='saved'?'Confirmed by you':'Nothing to review'},
    {name:'Save',icon:BookOpen,active:phase==='saving',done:phase==='saved',text:phase==='saving'?'Saving to SQLite':phase==='saved'?'Receipt received':'No write yet'},
  ];
  return <section className="agent-rail" aria-label="Live agent activity"><div className="agent-rail-heading"><span>Behind your words</span><span>ON THIS DEVICE</span></div><ol>{list.map((item,i)=><li key={item.name} className={item.active?'running':item.done?'complete':''}><span className="agent-node">{item.done?<Check size={15}/>:<item.icon size={15}/>}</span><span><strong>{item.name}</strong><small>{item.text}</small></span>{i<3&&<ArrowRight className="agent-arrow" size={12}/>}</li>)}</ol></section>;
}
