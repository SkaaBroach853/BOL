import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const python=resolve(process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
async function run(command,args){
  const child=spawn(command,args,{stdio:'inherit',windowsHide:true,env:{...process.env,HF_HUB_DISABLE_TELEMETRY:'1'}});
  await new Promise((ok,fail)=>{child.once('error',fail);child.once('exit',code=>code===0?ok():fail(new Error(`Setup step failed (${code}).`)));});
}
try{
  if(!existsSync(python))await run(process.platform==='win32'?'python':'python3',['-m','venv','.venv']);
  await run(python,['-m','pip','--isolated','install','-r','local-ai/requirements.txt','--cache-dir','.pip-cache','--disable-pip-version-check']);
  await run(python,['local-ai/download_model.py',resolve('models/whisper-base')]);
  console.log('\nLocal speech installed. No API key. Run npm start (or npm run dev).');
}catch(error){console.error(error.message);process.exitCode=1;}
