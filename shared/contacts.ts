import {formatMoney} from './format';
export function normalizePhone(value:string){
 const digits=value.replace(/[\s()+-]/g,'');
 const phone=/^[6-9]\d{9}$/.test(digits)?'91'+digits:digits;
 if(phone!==''&&!/^[1-9]\d{7,14}$/.test(phone))throw new Error('Enter a valid phone number with country code, or a 10-digit Indian mobile number.');
 return phone;
}
export function whatsappReminder(name:string,phone:string,balance:number){
 const number=normalizePhone(phone);if(!number||balance<=0)return null;
 const text=`Namaste ${name}, your outstanding at Corner Chai is ${formatMoney(balance)}. Please pay when convenient. Thank you.`;
 return 'https://wa.me/'+number+'?text='+encodeURIComponent(text);
}
