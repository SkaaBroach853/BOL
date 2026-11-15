import { spawn } from 'node:child_process';
// Direct Node children avoid npm/cmd process-tree teardown problems on Windows.
const env={...process.env,PORT:'3101',HOST:'127.0.0.1',DATABASE_PATH:'./data/browser-tests.sqlite',OPENAI_API_KEY:''};
try{await fetch('http://127.0.0.1:3101/api/health',{signal:AbortSignal.timeout(700)});console.error('Port 3101 is occupied. Stop the old test server first.');process.exit(1);}catch{}
const server=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{env,stdio:'inherit',windowsHide:true});
let exited=false;server.on('exit',()=>{exited=true;});
const stop=()=>{if(!exited)server.kill('SIGTERM');};
process.on('exit',stop);process.on('SIGINT',()=>{stop();process.exit(130);});
try{
  let ready=false;
  for(let n=0;n<100&&!exited;n++){try{const r=await fetch('http://127.0.0.1:3101/api/health',{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw new Error('Test server did not start.');
  const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test',...process.argv.slice(2)],{env,stdio:'inherit',windowsHide:true});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  stop();process.exitCode=Number(code??1);
}catch(error){console.error(error.message);stop();process.exitCode=1;}
