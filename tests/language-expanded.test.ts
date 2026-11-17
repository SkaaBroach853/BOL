import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Ledger} from '../server/ledger.ts';
import {localIntent,resolveIntent} from '../server/interpreter.ts';
import {reviewCommand} from '../shared/language.ts';
import {normalizePhone,whatsappReminder} from '../shared/contacts.ts';
import {mkdtempSync,rmSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('owner Hinglish examples, composite amounts, conflicting names and balance statements',()=>{
 const l=new Ledger(':memory:');try{
 const cases:[string,string,string|null][]=[
  ['ramesh 100 ruppes add kardo','ADD_CREDIT','100'],
  ['meena ne 200 dediye mujhe batao kitna bacha hai','RECORD_REPAYMENT','200'],
  ['ramesh ne 50 ruppes diya','RECORD_REPAYMENT','50'],
  ['meena ke kaathe me 300 jama kardo','RECORD_REPAYMENT','300'],
  ['meena ke isme 500 rupay udhar hai','NEEDS_CLARIFICATION','500'],
  ['मीना ने दो सौ रुपये दिए मुझे बताओ कितना बचा है','RECORD_REPAYMENT','200'],
  ['मीना के खाते में तीन सौ जमा कर दो','RECORD_REPAYMENT','300'],
  ['meena credit five hundred twenty five','ADD_CREDIT','525'],
  ['meena credit do hazaar teen sau','ADD_CREDIT','2300'],
  ['Meena credit 1,000','ADD_CREDIT','1000'],
  ['Meena credit -100','ADD_CREDIT','-100'],
  ['Meena credit twenty thirty','ADD_CREDIT',null],
  ['Meena kitna bacha hai','SHOW_BALANCE',null],
  ['Meena ne 200 diye aur Suresh ne 100 diye','RECORD_REPAYMENT',null],
 ];
 for(const [text,intent,amount] of cases){const i=localIntent(text,l);assert.equal(i.intent,intent,text);assert.equal(i.amount,amount,text);}
 for(const text of ['ramesh 100 ruppes add kardo','meena ke isme 500 rupay udhar hai','Meena ne 200 diye aur Suresh ne 100 diye'])assert.equal(resolveIntent(localIntent(text,l),l,null,'typed').kind,'clarification',text);
 const meena=l.customers().find(c=>c.name==='Meena')!;
 l.confirm(l.propose({action:'ADD_CREDIT',customerId:meena.id,amount:'1000'}).id,randomUUID());
 const result=resolveIntent(localIntent('meena ne 200 dediye mujhe batao kitna bacha hai',l),l,l.latest()!.id,'typed');assert.equal(result.kind,'preview');if(result.kind==='preview')assert.equal(result.proposal.after,80000);
 assert.equal(l.customer(meena.id).balance,100000,'repayment plus balance question must remain a preview');
 }finally{l.close();}
});

test('voice confirmation accepts explicit phrases and rejects negation, questions and embedded commands',()=>{
 for(const text of ['sahi hai confirm','sahi hai to confirm','haan sahi hai','confirm','हाँ सही है','सही है कन्फर्म'])assert.equal(reviewCommand(text),'confirm',text);
 for(const text of ['phir se sunno','phir se suno','फिर से सुनो','listen again'])assert.equal(reviewCommand(text),'retry',text);
 for(const text of ['nahi confirm mat karo','not confirm','is this correct','confirm?','sahi hai','confirm meena credit 100','yes','do not confirm'])assert.equal(reviewCommand(text),'unknown',text);
 assert.equal(reviewCommand('cancel karo'),'cancel');
});

test('phone normalization persists without changing money and reminder links encode the saved balance',()=>{
 const l=new Ledger(':memory:');try{
  const c=l.addCustomer('Kavita','Tailor',randomUUID(),'+91 98765 43210');assert.equal(c.phone,'919876543210');assert.equal(l.updatePhone(c.id,'9876543211').phone,'919876543211');
  assert.equal(l.customer(c.id).balance,0);assert.equal(l.entries().length,0);
  assert.throws(()=>normalizePhone('not-a-number'));
  assert.equal(whatsappReminder('Kavita','',50000),null);
  const link=whatsappReminder('Kavita & Sons','919876543211',50000)!;assert.equal(new URL(link).host,'wa.me');assert.match(new URL(link).searchParams.get('text')!,/Kavita & Sons.*₹500/);
 }finally{l.close();}
});

test('existing SQLite ledger gains phone support without losing customers or financial history',()=>{
 const directory=mkdtempSync(join(tmpdir(),'bol-migration-')),file=join(directory,'legacy.sqlite');
 let l=new Ledger(file);
 try{
  const c=l.addCustomer('Kavita','Tailor',randomUUID());l.confirm(l.propose({action:'ADD_CREDIT',customerId:c.id,amount:'125.50'}).id,randomUUID());
  l.db.exec('ALTER TABLE customers DROP COLUMN phone');l.close();l=new Ledger(file);
  assert.equal(l.customer(c.id).balance,12550);assert.equal(l.customer(c.id).phone,'');assert.equal(l.entries().length,1);assert.equal(l.updatePhone(c.id,'9876543210').phone,'919876543210');
  const added=l.addCustomer('Nisha','Bakery',randomUUID());assert.equal(added.balance,0);assert.equal(l.entries().length,1);
 }finally{l.close();rmSync(file,{force:true});rmdirSync(directory);}
});
