import { SQLite } from './sqlite.ts';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { actionSchema, type Action, type Customer, type Entry, type Proposal, type Receipt, type Snapshot } from '../shared/contracts.ts';
import { DomainError, parseMoney } from './money.ts';
import {normalizePhone} from '../shared/contacts.ts';

type Canonical = { action: Action['action']; customerId: string; amount: number; targetId?: string; head?: number };
type ProposalRow = { id:string; shopId:string; payload:string; expiresAt:string; state:string };
export const normalize = (s:string) => s.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
const hash = (s:string) => createHash('sha256').update(s).digest('hex');
const now = () => new Date().toISOString();
function fail(code:string,message:string,status=409):never {throw new DomainError(code,message,status);}

export class Ledger {
  db: SQLite;
  constructor(path:string, public limit=1_000_000, public ttlSeconds=300) {
    if(path!==':memory:') mkdirSync(dirname(path),{recursive:true});
    this.db=new SQLite(path);
    this.db.pragma('journal_mode = WAL'); this.db.pragma('foreign_keys = ON'); this.db.pragma('busy_timeout = 5000'); this.db.pragma('synchronous = FULL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shops(id TEXT PRIMARY KEY,name TEXT NOT NULL,createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,shopId TEXT NOT NULL REFERENCES shops(id),name TEXT NOT NULL,label TEXT NOT NULL,aliases TEXT NOT NULL DEFAULT '',createdAt TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS customer_shop ON customers(shopId);
      CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,shopId TEXT NOT NULL REFERENCES shops(id),payload TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','confirmed','cancelled')),expiresAt TEXT NOT NULL,createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS operations(operationId TEXT NOT NULL,shopId TEXT NOT NULL REFERENCES shops(id),payloadHash TEXT NOT NULL,receipt TEXT NOT NULL,PRIMARY KEY(shopId,operationId));
      CREATE TABLE IF NOT EXISTS ledger_entries(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,shopId TEXT NOT NULL REFERENCES shops(id),customerId TEXT NOT NULL REFERENCES customers(id),type TEXT NOT NULL CHECK(type IN ('CREDIT','REPAYMENT','REVERSAL')),amount INTEGER NOT NULL CHECK(amount>0),delta INTEGER NOT NULL CHECK(abs(delta)=amount),relatedId TEXT REFERENCES ledger_entries(id),operationId TEXT NOT NULL,createdAt TEXT NOT NULL,CHECK((type='CREDIT' AND delta>0) OR (type='REPAYMENT' AND delta<0) OR type='REVERSAL'),FOREIGN KEY(shopId,operationId) REFERENCES operations(shopId,operationId) DEFERRABLE INITIALLY DEFERRED);
      CREATE INDEX IF NOT EXISTS ledger_customer ON ledger_entries(shopId,customerId,seq);
      CREATE INDEX IF NOT EXISTS ledger_shop ON ledger_entries(shopId,seq);
      CREATE UNIQUE INDEX IF NOT EXISTS one_reversal ON ledger_entries(relatedId) WHERE type='REVERSAL';
      CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger_entries BEGIN SELECT RAISE(ABORT,'Immutable ledger'); END;
      CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger_entries BEGIN SELECT RAISE(ABORT,'Immutable ledger'); END;
    `);
    if(!(this.db.prepare('PRAGMA table_info(customers)').all() as {name:string}[]).some(c=>c.name==='phone'))this.db.exec("ALTER TABLE customers ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
    this.db.transaction(()=>{ if(!this.db.prepare("SELECT value FROM meta WHERE key='shop'").get()) this.newDemoShop(); })();
  }
  get shopId():string { return (this.db.prepare("SELECT value FROM meta WHERE key='shop'").get() as {value:string}).value; }
  newDemoShop() {
    const id=randomUUID();
    this.db.prepare('INSERT INTO shops VALUES(?,?,?)').run(id,'Corner Chai',now());
    this.db.prepare("INSERT INTO meta VALUES('shop',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(id);
    const insert=this.db.prepare('INSERT INTO customers(id,shopId,name,label,aliases,createdAt) VALUES(?,?,?,?,?,?)');
    for(const [name,label,aliases] of [['Ramesh','Auto driver','रमेश'],['Suresh','Book shop','सुरेश'],['Meena','Flower stall','मीना'],['Ramesh','Electrician','रमेश']]) insert.run(randomUUID(),id,name,label,aliases,now());
    return id;
  }
  reset(phrase:string) { if(phrase!=='RESET DEMO') fail('RESET_PHRASE','Type RESET DEMO to create a fresh sample shop.',400); return this.db.transaction(()=>this.newDemoShop()).immediate(); }
  customers():Customer[] {
    return this.db.prepare(`SELECT c.id,c.name,c.label,c.aliases,c.phone,COALESCE(SUM(e.delta),0) balance FROM customers c LEFT JOIN ledger_entries e ON e.customerId=c.id AND e.shopId=c.shopId WHERE c.shopId=? GROUP BY c.id ORDER BY c.name,c.label`).all(this.shopId) as Customer[];
  }
  customer(id:string):Customer { return this.customers().find(c=>c.id===id) ?? fail('CUSTOMER_NOT_FOUND','Choose a customer in this shop.',404); }
  resolve(query:string):Customer[] {
    const q=normalize(query); if(!q) return [];
    return this.customers().filter(c=>[c.name,...c.aliases.split('|'),c.name+' '+c.label].some(n=>normalize(n)===q));
  }
  addCustomer(name:string,label:string,operationId:string,phone=''):Customer {
    return this.db.transaction(()=>{
      const normalizedPhone=normalizePhone(phone);
      const payload=JSON.stringify({name:normalize(name),label:normalize(label),...(normalizedPhone?{phone:normalizedPhone}:{})});
      const existing=this.recover(operationId,payload); if(existing) return existing as unknown as Customer;
      const customer={id:randomUUID(),name:name.trim(),label:label.trim(),aliases:'',balance:0,phone:normalizedPhone};
      this.db.prepare('INSERT INTO customers(id,shopId,name,label,aliases,createdAt,phone) VALUES(?,?,?,?,?,?,?)').run(customer.id,this.shopId,customer.name,customer.label,'',now(),normalizedPhone);
      this.db.prepare('INSERT INTO operations VALUES(?,?,?,?)').run(operationId,this.shopId,hash(payload),JSON.stringify(customer)); return customer;
    }).immediate();
  }
  updatePhone(id:string,phone:string):Customer {
    this.customer(id);
    const normalized=normalizePhone(phone);
    this.db.prepare('UPDATE customers SET phone=? WHERE id=? AND shopId=?').run(normalized,id,this.shopId);
    return this.customer(id);
  }
  entries(customerId?:string):Entry[] {
    return this.db.prepare(`SELECT e.*,c.name,c.label FROM ledger_entries e JOIN customers c ON c.id=e.customerId WHERE e.shopId=? ${customerId?'AND e.customerId=?':''} ORDER BY e.seq DESC`).all(...(customerId?[this.shopId,customerId]:[this.shopId])) as Entry[];
  }
  latest():Entry|null { return this.entries()[0]??null; }
  snapshot():Snapshot { return this.db.transaction(()=>{const customers=this.customers(),entries=this.entries(); return {shopId:this.shopId,customers,entries,total:customers.reduce((s,c)=>s+c.balance,0),latest:entries[0]??null};})(); }
  private validate(c:Canonical) {
    const customer=this.customer(c.customerId);
    if(c.action==='RECORD_REPAYMENT' && customer.balance<c.amount) fail('OVERPAYMENT','Repayment exceeds the current outstanding. Review the amount.');
    if(c.action==='CORRECT_LAST_CUSTOMER'||c.action==='REVERSE_LAST') {
      const target=this.latest();
      if(!target||target.id!==c.targetId||target.seq!==c.head||target.type==='REVERSAL') fail('STALE_TARGET','The ledger changed. Preview the latest transaction again.');
      if(this.db.prepare("SELECT id FROM ledger_entries WHERE relatedId=? AND type='REVERSAL'").get(target.id)) fail('ALREADY_REVERSED','This transaction has already been reversed.');
      const original=this.customer(target.customerId);
      if(target.delta>0&&original.balance<target.amount) fail('INVALID_BALANCE','Moving or reversing this credit would invalidate the balance. Review the history.');
      if(c.action==='CORRECT_LAST_CUSTOMER') {
        if(target.type!=='CREDIT') fail('NOT_CREDIT','Only the latest credit can move to another customer.');
        if(c.customerId===target.customerId) fail('SAME_CUSTOMER','Choose a different customer.',400);
      }
      return {customer, target, original};
    }
    return {customer, target:null, original:null};
  }
  propose(input:unknown):Proposal {
    const action=actionSchema.parse(input);
    return this.db.transaction(()=>{
      let c:Canonical;
      if(action.action==='ADD_CREDIT'||action.action==='RECORD_REPAYMENT') c={action:action.action,customerId:action.customerId,amount:parseMoney(action.amount,this.limit)};
      else {
        const target=this.latest();
        if(!target||target.id!==action.targetId) fail('STALE_TARGET','The latest transaction changed. Refresh and try again.');
        c={action:action.action,customerId:action.action==='CORRECT_LAST_CUSTOMER'?action.customerId:target.customerId,amount:target.amount,targetId:target.id,head:target.seq};
      }
      this.validate(c);
      const id=randomUUID(),expiresAt=new Date(Date.now()+this.ttlSeconds*1000).toISOString();
      this.db.prepare("INSERT INTO proposals VALUES(?,?,?,'pending',?,?)").run(id,this.shopId,JSON.stringify(c),expiresAt,now());
      return this.preview(id);
    }).immediate();
  }
  private row(id:string):ProposalRow { return this.db.prepare('SELECT * FROM proposals WHERE id=? AND shopId=?').get(id,this.shopId) as ProposalRow ?? fail('PROPOSAL_NOT_FOUND','Preview not found. Create a new preview.',404); }
  preview(id:string):Proposal {
    const row=this.row(id),c=JSON.parse(row.payload) as Canonical,{customer,target,original}=this.validate(c);
    const delta=c.action==='ADD_CREDIT'||c.action==='CORRECT_LAST_CUSTOMER'?c.amount:c.action==='RECORD_REPAYMENT'?-c.amount:-(target?.delta??0);
    return {id,action:c.action,customerId:c.customerId,name:customer.name,label:customer.label,amount:c.amount,before:customer.balance,after:customer.balance+delta,targetId:c.targetId,originalName:original?.name,originalLabel:original?.label,originalBefore:original?.balance,originalAfter:original?original.balance-(target?.delta??0):undefined,expiresAt:row.expiresAt,state:row.state};
  }
  recover(operationId:string,payload?:string):Receipt|null {
    const row=this.db.prepare('SELECT * FROM operations WHERE operationId=? AND shopId=?').get(operationId,this.shopId) as {payloadHash:string;receipt:string}|undefined;
    if(!row) return null;
    if(payload!==undefined && row.payloadHash!==hash(payload)) fail('OPERATION_CONFLICT','This operation ID belongs to a different request.');
    return JSON.parse(row.receipt) as Receipt;
  }
  confirm(id:string,operationId:string):Receipt {
    return this.db.transaction(()=>{
      const payload=JSON.stringify({proposalId:id});
      const existing=this.recover(operationId,payload); if(existing) return existing;
      const row=this.row(id);
      if(row.state!=='pending') fail('PROPOSAL_CLOSED','This preview was already confirmed or cancelled.');
      if(Date.parse(row.expiresAt)<=Date.now()) fail('PROPOSAL_EXPIRED','This preview expired. Review a new preview.');
      const c=JSON.parse(row.payload) as Canonical,{target}=this.validate(c),createdAt=now();
      const ids:string[]=[];
      const insert=(customerId:string,type:Entry['type'],delta:number,relatedId:string|null)=>{
        const entryId=randomUUID(); ids.push(entryId);
        this.db.prepare('INSERT INTO ledger_entries(id,shopId,customerId,type,amount,delta,relatedId,operationId,createdAt) VALUES(?,?,?,?,?,?,?,?,?)').run(entryId,this.shopId,customerId,type,c.amount,delta,relatedId,operationId,createdAt);
      };
      if(target) {
        insert(target.customerId,'REVERSAL',-target.delta,target.id);
        if(c.action==='CORRECT_LAST_CUSTOMER') insert(c.customerId,'CREDIT',c.amount,target.id);
      } else insert(c.customerId,c.action==='ADD_CREDIT'?'CREDIT':'REPAYMENT',c.action==='ADD_CREDIT'?c.amount:-c.amount,null);
      const entries=this.entries().filter(e=>ids.includes(e.id)).reverse();
      const affected=new Set(entries.map(e=>e.customerId));
      const receipt:Receipt={id:randomUUID(),operationId,proposalId:id,action:c.action,createdAt,entries,balances:this.customers().filter(c=>affected.has(c.id)).map(c=>({customerId:c.id,name:c.name,balance:c.balance}))};
      this.db.prepare('INSERT INTO operations VALUES(?,?,?,?)').run(operationId,this.shopId,hash(payload),JSON.stringify(receipt));
      this.db.prepare("UPDATE proposals SET state='confirmed' WHERE id=?").run(id);
      return receipt;
    }).immediate();
  }
  cancel(id:string) { this.db.prepare("UPDATE proposals SET state='cancelled' WHERE id=? AND shopId=? AND state='pending'").run(id,this.shopId); }
  close(){this.db.close();}
}
