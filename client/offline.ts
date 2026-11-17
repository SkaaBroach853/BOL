import type {Snapshot} from '../shared/contracts';
import {readLocal,writeLocal} from './api';
export type OfflineDraft={id:string;operationId:string;shopId:string;customerId:string;action:'ADD_CREDIT'|'RECORD_REPAYMENT';amount:string;createdAt:string};
const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('bol-local',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});
async function transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode);let result:T;const request=run(tx.objectStore('drafts'));request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error??new Error('Local storage write interrupted.'));};});
}
const changed=()=>window.dispatchEvent(new Event('bol-queue-changed'));
export async function drafts(){return (await transaction('readonly',s=>s.getAll())) as OfflineDraft[];}
export async function storeDraft(draft:OfflineDraft){await transaction('readwrite',s=>s.put(draft));changed();}
export async function removeDraft(id:string){await transaction('readwrite',s=>s.delete(id));changed();}
export async function clearConfirmed(operationId:string){for(const d of await drafts())if(d.operationId===operationId)await removeDraft(d.id);}
export function cachedSnapshot(){return readLocal<Snapshot>('bol-snapshot');}
export function cacheSnapshot(snapshot:Snapshot){return writeLocal('bol-snapshot',snapshot);}
