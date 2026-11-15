import type { Health } from '../shared/contracts';
let csrf='';
export class ApiError extends Error {constructor(message:string,public code:string,public status:number){super(message);}}
export async function api<T>(path:string,body?:unknown,options:{signal?:AbortSignal;raw?:boolean;mime?:string}={}):Promise<T> {
  let response:Response;
  try {response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':options.mime??'application/json','x-bol-csrf':csrf},body:body===undefined?undefined:options.raw?body as BodyInit:JSON.stringify(body),signal:options.signal??AbortSignal.timeout(130000)});}catch(e){if(e instanceof DOMException&&e.name==='AbortError')throw e;throw new ApiError('Cannot reach the local server. Your draft is not saved to the ledger. Reconnect and retry.','NETWORK',0);}
  const result=await response.json();if(!response.ok)throw new ApiError(result.message??'Request failed.',result.code??'UNKNOWN',response.status);return result as T;
}
export async function health(){const h=await api<Health>('/health');csrf=h.csrfToken;return h;}
export function readLocal<T>(key:string):T|null{try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}}
export function writeLocal(key:string,value:unknown){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
