import { intentSchema, type Intent, type Interpretation } from '../shared/contracts.ts';
import { Ledger } from './ledger.ts';
import { DomainError } from './money.ts';

import {parseInstruction} from '../shared/language.ts';
export function localIntent(text:string,ledger:Ledger):Intent {return parseInstruction(text,ledger.customers());}
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
  if(candidates.length!==1||missingAmount||ambiguous) return {kind:'clarification',message:i.message??(ambiguous?'Is this credit given or a repayment received? Review the customer and amount too.':candidates.length>1?'More than one customer matches. Choose the distinguishing label.':!candidates.length?'Choose a customer. Add a new customer in Customers if needed.':'What is the amount in rupees?'),candidates:candidates.length?candidates:ledger.customers(),action:ambiguous?null:i.intent,amount:i.amount,source,targetId};
  const customerId=candidates[0].id;
  const action=i.intent==='CORRECT_LAST_CUSTOMER'?{action:i.intent,customerId,targetId}:{action:i.intent,customerId,amount:i.amount};
  return {kind:'preview',proposal:ledger.propose(action),source};
}
