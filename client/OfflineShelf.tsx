import {useEffect,useState} from 'react';
import {CloudUpload,Trash2} from 'lucide-react';
import {drafts,removeDraft,type OfflineDraft} from './offline';
import type {Customer} from '../shared/contracts';
export function OfflineShelf({customers,connected,busy,onReview}:{customers:Customer[];connected:boolean;busy:boolean;onReview:(item:OfflineDraft)=>void}){
 const [items,setItems]=useState<OfflineDraft[]>([]),[error,setError]=useState('');
 useEffect(()=>{let alive=true;const refresh=()=>void drafts().then(d=>{if(alive)setItems(d);}).catch(()=>{if(alive)setError('Local drafts storage could not be read.');});refresh();window.addEventListener('bol-queue-changed',refresh);return()=>{alive=false;window.removeEventListener('bol-queue-changed',refresh);};},[]);
 if(!items.length&&!error)return null;
 return <section className="offline-shelf" aria-label="Entries saved on this device"><div className="section-heading"><div><h2><CloudUpload size={18}/> Saved on this device</h2><p>{items.length} awaiting review and ledger sync. Not included in balances.</p></div></div>{error&&<p role="alert">{error}</p>}{items.map(d=><div className="offline-draft" key={d.id}><div><strong>{customers.find(c=>c.id===d.customerId)?.name??'Customer'} · ₹{d.amount}</strong><small>{d.action==='ADD_CREDIT'?'Credit given':'Repayment received'} · Awaiting ledger sync</small></div><button className="secondary" disabled={!connected||busy} onClick={()=>onReview(d)}>Review & sync</button><button className="icon-button" aria-label="Delete local draft" disabled={busy} onClick={()=>void removeDraft(d.id).catch(e=>setError(e.message))}><Trash2 size={16}/></button></div>)}</section>;
}
