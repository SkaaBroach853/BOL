import type {Customer,Intent} from './contracts';

const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[०-९]/g,c=>String(c.charCodeAt(0)-0x966)).replace(/\s+/g,' ').trim();
const numbers:Record<string,number>={};
const groups=[
 ['zero','shunya','शून्य'],['one','ek','एक'],['two','do','दो'],['three','teen','तीन'],['four','char','chaar','चार'],['five','panch','paanch','पांच','पाँच','पाँच'],['six','chhe','chhah','छह'],['seven','saat','सात'],['eight','aath','आठ'],['nine','nau','नौ'],['ten','das','दस'],['eleven','gyarah','ग्यारह'],['twelve','barah','बारह'],['thirteen','terah','तेरह'],['fourteen','chaudah','चौदह'],['fifteen','pandrah','पंद्रह'],['sixteen','solah','सोलह'],['seventeen','satrah','सत्रह'],['eighteen','atharah','अठारह'],['nineteen','unnis','उन्नीस'],
];
groups.forEach((list,n)=>list.forEach(word=>numbers[word]=n));
for(const [n,list] of [[20,['twenty','bees','bis','बीस']],[25,['pachis','pachchis','पच्चीस']],[30,['thirty','tees','तीस']],[35,['paintis','पैंतीस']],[40,['forty','chalis','chaalis','चालीस']],[45,['paintalis','पैंतालीस']],[50,['fifty','pachas','pachaas','पचास']],[55,['pachpan','पचपन']],[60,['sixty','saath','साठ']],[65,['painsath','पैंसठ']],[70,['seventy','sattar','सत्तर']],[75,['pachattar','पचहत्तर']],[80,['eighty','assi','अस्सी']],[85,['pachasi','पचासी']],[90,['ninety','nabbe','नब्बे']],[95,['pachanve','पंचानवे']]] as [number,string[]][])list.forEach(word=>numbers[word]=n);
const scales:Record<string,number>={hundred:100,sau:100,'सौ':100,thousand:1000,hazar:1000,hazaar:1000,'हजार':1000,'हज़ार':1000};
function numberPhrase(tokens:string[]):string|null {
 if(tokens.length===1&&/^-?\d+(?:\.\d+)?$/.test(tokens[0]))return tokens[0];
 let total=0,chunk=0,last=-1,previousScale=Infinity;
 for(const token of tokens){
  if(token==='and')continue;
  if(scales[token]){const scale=scales[token];if(scale>=previousScale)return null;chunk=(chunk||1)*scale;if(scale>=1000){total+=chunk;chunk=0;}previousScale=scale;last=-1;}
  else {const n=numbers[token]??(/^\d+$/.test(token)?Number(token):NaN);if(!Number.isFinite(n))return null;if(last>=0&&!(last>=20&&last%10===0&&n>0&&n<10))return null;chunk+=n;last=n;}
 }
 return String(total+chunk);
}
export function parseInstruction(text:string,customers:Customer[]):Intent {
 const t=normalize(text).replace(/\b(\d{1,3}(?:,\d{3})+)(?!\d)/g,m=>m.replaceAll(',',''));
 const base={customerQuery:null as string|null,amount:null as string|null,missingFields:[] as Intent['missingFields'],message:null as string|null};
 if(/ignore|system prompt|delete|drop table|transfer|upi|send money|order|weather|मौसम|भेजो/.test(t))return {intent:'UNSUPPORTED',...base};
 const boundary=(s:string,pos:number)=>!(pos>0&&/[\p{L}\p{N}]/u.test(s[pos-1]));
 const matches=customers.flatMap(c=>[c.name,...c.aliases.split('|'),c.name+' '+c.label].filter(Boolean).map(n=>({n,p:t.lastIndexOf(normalize(n))}))).filter(x=>x.p>=0&&boundary(t,x.p)&&!/[\p{L}\p{N}]/u.test(t[x.p+normalize(x.n).length]??'')).sort((a,b)=>b.p-a.p||b.n.length-a.n.length);
 base.customerQuery=matches[0]?.n??null;
 // Strip matched names before parsing amounts: a label such as Shop 2 is not an amount.
 let amountText=t;
 for(const match of matches)amountText=amountText.replaceAll(normalize(match.n),' ');
 const tokens=amountText.replace(/\bkar\s+do\b|कर\s+दो/g,' ').replace(/\brs\.?\s*(?=\d)/g,' ').replace(/[।,!?:₹]/g,' ').replace(/(\d)(rupees|ruppes|rupaye|rupay|rupya|rs\b)/g,'$1 $2').replace(/(?<!\d)\.(?!\d)|(?<=\d)\.(?!\d)/g,' ').split(/\s+/).filter(Boolean);
 const amounts:(string|null)[]=[];let run:string[]=[];
 const flush=()=>{if(run.length)amounts.push(numberPhrase(run));run=[];};
 for(const token of tokens){if(/^-?\d+(?:\.\d+)?$/.test(token)||token in numbers||token in scales||token==='and'&&run.length)run.push(token);else flush();}flush();
 base.amount=amounts.length===1?amounts[0]:null;
 if(/^(undo|reverse|cancel last)|आखिरी.*रद्द|पिछली.*रद्द/.test(t))return {intent:'REVERSE_LAST',...base};
 if(/^(nahi|nahin|नहीं|नही)|\bcorrect\b|\binstead\b|बदलो/.test(t))return {intent:'CORRECT_LAST_CUSTOMER',...base};
 const credit=/\b(credit|udhaar|udhar|owed)\b|उधार|उधार|\badd\s*(kar\s*do|kardo|karo)?\b|जोड़|जोड़/.test(t);
 const jama=/\bjama\b|जमा/.test(t);
 const repayment=/\b(paid|repaid|repayment|returned)\b|वापस|चुकाए|चुकाये|चुकाया|\bne\b.*\b(de\s*diye|dediye|diye|diya|diyeh|de\s*diya)\b|ने.*(दिए|दिये|दिया)/.test(t)||jama;
 const balance=/\bbalance\b|\boutstanding\b|\b(kitna|kitne|kitni).*\b(bacha|baki|baaki)\b|\b(bacha|baki|baaki)\b|बाकी|बकाया|कितना.*बचा/.test(t);
 // A statement of existing debt does not authorize adding that amount again.
 const assertedDebt=credit&&/\b(udhaar|udhar|owed)\s+(hai|hain)\b|उधार\s+है/.test(t)&&!/\b(add|likho|likh|jod|jodo|kardo|karo)\b|लिखो|जोड़/.test(t);
 let intent:Intent['intent']=assertedDebt||credit&&repayment?'NEEDS_CLARIFICATION':repayment?'RECORD_REPAYMENT':credit?'ADD_CREDIT':balance?'SHOW_BALANCE':'NEEDS_CLARIFICATION';
 if(balance&&amounts.length===0)intent='SHOW_BALANCE';
 // Distinct names require a choice. Corrections above intentionally select the last name.
 const distinct=customers.filter(c=>matches.some(m=>[c.name,...c.aliases.split('|'),c.name+' '+c.label].some(n=>normalize(n)===normalize(m.n))));
 if(new Set(distinct.map(c=>normalize(c.name))).size>1){base.customerQuery=null;base.message='More than one customer was spoken. Record one customer at a time.';}
 if(!base.customerQuery)base.missingFields.push('customer');
 if(!base.amount&&intent!=='SHOW_BALANCE')base.missingFields.push('amount');
 if(intent==='NEEDS_CLARIFICATION')base.missingFields.push('direction');
 if(assertedDebt)base.message='Is this a new credit to add, or are you describing an existing balance? Existing balances are never overwritten.';
 return {intent,...base};
}

export function reviewCommand(text:string):'confirm'|'retry'|'cancel'|'unknown' {
 if(text.includes('?'))return 'unknown';
 const t=normalize(text).replace(/[.,!।?]/g,'').trim();
 if(/^(phir se (suno|sunno|sunao)|fir se (suno|sunno)|dobara suno|listen again|try again|फिर से सुनो|दोबारा सुनो)$/.test(t))return 'retry';
 if(/^(cancel|cancel karo|radd karo|रद्द करो|रद्द|रुको|ruk jao)$/.test(t))return 'cancel';
 if(/^(confirm|confirm karo|haan confirm|han confirm|yes confirm|sahi hai( to)? confirm|haan sahi hai( confirm)?|han sahi hai( confirm)?|हाँ सही है( कन्फर्म)?|हां सही है( कन्फर्म)?|सही है( तो)? (कन्फर्म|कंफर्म)|कन्फर्म|कंफर्म)$/.test(t))return 'confirm';
 return 'unknown';
}
