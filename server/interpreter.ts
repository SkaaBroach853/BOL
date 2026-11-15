import { intentSchema, type Intent, type Interpretation } from '../shared/contracts.ts';
import { Ledger, normalize } from './ledger.ts';
import { DomainError } from './money.ts';

const words:Record<string,string>={one:'1',two:'2',five:'5',ten:'10',twenty:'20',thirty:'30',forty:'40',fifty:'50',hundred:'100',ek:'1',do:'2',paanch:'5',das:'10',bees:'20',bis:'20',tees:'30',chalis:'40',chaalis:'40',pachas:'50',pachaas:'50',sau:'100','एक':'1','दो':'2','पांच':'5','पाँच':'5','दस':'10','बीस':'20','तीस':'30','चालीस':'40','पचास':'50','सौ':'100'};
export function localIntent(text:string,ledger:Ledger):Intent {
  const t=normalize(text).replace(/[०-९]/g,c=>String(c.charCodeAt(0)-0x966));
  const base={customerQuery:null as string|null,amount:null as string|null,missingFields:[] as Intent['missingFields'],message:null as string|null};
  if(/ignore|system prompt|delete|drop table|transfer|upi|send money|order|weather|मौसम|भेजो/.test(t)) return {intent:'UNSUPPORTED',...base};
  const tokens=t.replace(/[।,!?:]/g,' ').split(/\s+/);
  const matches=ledger.customers().flatMap(c=>[c.name,...c.aliases.split('|'),c.name+' '+c.label]).filter(Boolean).map(n=>({n,p:t.lastIndexOf(normalize(n))})).filter(x=>x.p>=0).sort((a,b)=>b.p-a.p||b.n.length-a.n.length);
  // A bounded, disclosed rule parser for typed input. It is never a substitute for transcription.
  base.customerQuery=matches[0]?.n??null;
  const amounts=tokens.flatMap(token=>/^\d+(?:\.\d+)?$/.test(token)?[token]:words[token]?[words[token]]:[]);
  base.amount=amounts.length===1?amounts[0]:null;
  if(/^(undo|reverse|cancel last)|आखिरी.*रद्द|पिछली.*रद्द/.test(t)) return {intent:'REVERSE_LAST',...base};
  if(/^(nahi|nahin|नहीं|नही)|correct|instead|बदलो/.test(t)) return {intent:'CORRECT_LAST_CUSTOMER',...base};
  if(/balance|outstanding|बाकी|बकाया/.test(t)) return {intent:'SHOW_BALANCE',...base};
  const credit=/\b(credit|udhaar|udhar|owed)\b|उधार|उधार/.test(t);
  const repayment=/\b(paid|repaid|repayment|returned)\b|वापस|चुकाए|चुकाये|\bne\b.*\bdiye\b|ने.*दिए|ने.*दिये/.test(t);
  const intent=credit&&!repayment?'ADD_CREDIT':repayment&&!credit?'RECORD_REPAYMENT':'NEEDS_CLARIFICATION';
  if(!base.customerQuery) base.missingFields.push('customer');
  if(!base.amount) base.missingFields.push('amount');
  if(intent==='NEEDS_CLARIFICATION') base.missingFields.push('direction');
  return {intent,...base};
}
export function resolveIntent(raw:unknown,ledger:Ledger,targetId:string|null,source:string):Interpretation {
  const i=intentSchema.parse(raw);
  if(i.intent==='UNSUPPORTED') return {kind:'unsupported',message:'BOL can record credit, repayments, balances, and corrections. Choose a ledger action.',source};
  const candidates=i.customerQuery?ledger.resolve(i.customerQuery):[];
  if(i.intent==='SHOW_BALANCE') {
    if(candidates.length===1) return {kind:'balance',customers:candidates,source};
    return {kind:'clarification',message:'Choose whose balance to view.',candidates:candidates.length?candidates:ledger.customers(),action:'SHOW_BALANCE',amount:null,source};
  }
  const correction=i.intent==='CORRECT_LAST_CUSTOMER'||i.intent==='REVERSE_LAST';
  if(correction&&!targetId) throw new DomainError('NO_TARGET','There is no eligible last transaction. Record an entry first.',409);
  if(i.intent==='REVERSE_LAST') return {kind:'preview',proposal:ledger.propose({action:'REVERSE_LAST',targetId}),source};
  const missingAmount=!correction&&(!i.amount||i.missingFields.includes('amount'));
  const ambiguous=i.intent==='NEEDS_CLARIFICATION'||i.missingFields.includes('direction');
  if(candidates.length!==1||missingAmount||ambiguous) return {kind:'clarification',message:ambiguous?'Is this credit given or a repayment received? Review the customer and amount too.':candidates.length>1?'More than one customer matches. Choose the distinguishing label.':!candidates.length?'Choose a customer. Add a new customer in Customers if needed.':'What is the amount in rupees?',candidates:candidates.length?candidates:ledger.customers(),action:ambiguous?null:i.intent,amount:i.amount,source,targetId};
  const customerId=candidates[0].id;
  const action=i.intent==='CORRECT_LAST_CUSTOMER'?{action:i.intent,customerId,targetId}:{action:i.intent,customerId,amount:i.amount};
  return {kind:'preview',proposal:ledger.propose(action),source};
}
