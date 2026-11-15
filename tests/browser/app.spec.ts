import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('docs/screenshots',{recursive:true});
const timings:number[]=[];
test.beforeEach(async({request,page})=>{
  const h=await(await request.get('/api/health')).json();await request.post('/api/demo/reset',{headers:{'x-bol-csrf':h.csrfToken},data:{phrase:'RESET DEMO'}});
  await page.goto('/');await expect(page.getByText('Local ledger connected',{exact:true})).toBeVisible();
});
async function manual(page:Page,name:string,amount:string,repayment=false){
  await page.getByRole('button',{name:'Enter manually'}).click();const dialog=page.getByRole('dialog',{name:'New ledger entry'});
  if(repayment)await dialog.getByLabel('Transaction type').selectOption('RECORD_REPAYMENT');
  await dialog.getByLabel('Customer',{exact:true}).selectOption({label:name});await dialog.getByLabel('Amount in rupees',{exact:true}).fill(amount);await dialog.getByRole('button',{name:'Review entry'}).click();
  await expect(page.getByRole('heading',{name:repayment?'Repayment received':'Credit added',exact:true})).toBeVisible();
}
async function confirm(page:Page){const start=Date.now();await page.getByRole('button',{name:'Confirm & save'}).click();await expect(page.getByText('Saved to SQLite',{exact:true})).toBeVisible();timings.push(Date.now()-start);await page.getByRole('button',{name:'Done',exact:true}).click();}
test('manual central journey, linked correction, refresh, customer receipt and CSV',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/screenshots/01-home-desktop.png',fullPage:true});
  await manual(page,'Ramesh · Auto driver','40');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/screenshots/02-confirm-preview.png',fullPage:true});await confirm(page);
  await page.getByRole('button',{name:'Correct latest transaction'}).click();await page.getByLabel('Move credit to').selectOption({label:'Suresh · Book shop'});await page.getByRole('button',{name:'Preview customer correction'}).click();await expect(page.getByRole('heading',{name:'Customer corrected',exact:true})).toBeVisible();await confirm(page);
  await manual(page,'Suresh · Book shop','20',true);await confirm(page);await expect(page.locator('.outstanding-value')).toHaveText('₹20');
  await page.reload();await expect(page.locator('.outstanding-value')).toHaveText('₹20');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/screenshots/03-home-saved.png',fullPage:true});
  await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Customers'}).click();await expect(page.getByRole('button',{name:/Suresh.*₹20/})).toBeVisible();await expect(page.getByRole('button',{name:/Ramesh.*Auto driver.*₹0/})).toBeVisible();
  await page.getByRole('button',{name:/Suresh.*₹20/}).click();await expect(page.getByRole('dialog',{name:'Suresh · Book shop'})).toBeVisible();await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Activity'}).click();await expect(page.getByText('4 immutable events · Newest first')).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/screenshots/04-activity-linked.png',fullPage:true});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();const file=await download;expect(file.suggestedFilename()).toBe('bol-ledger.csv');await file.path();
  expect(errors).toEqual([]);writeFileSync('docs/browser-timings.json',JSON.stringify({metric:'UI confirmation click to visible saved receipt',environment:'Headless installed Microsoft Edge / Windows / localhost',observationsMs:timings,liveProvider:false},null,2));
});
test('typed duplicate name clarification, cancellation and accurate setup state',async({page})=>{
  await page.getByRole('button',{name:'Start voice recording'}).click();await expect(page.getByRole('alert')).toContainText('Install the local speech model');
  await page.getByText('Type a Hindi or English instruction',{exact:true}).click();await page.getByLabel('Typed input',{exact:true}).fill('Ramesh ko chalis rupaye udhaar likho');await page.getByRole('button',{name:'Review typed instruction'}).click();
  await expect(page.getByRole('heading',{name:'Let’s get this right.'})).toBeVisible();await expect(page.getByText('More than one customer matches. Choose the distinguishing label.')).toBeVisible();await expect(page.locator('.outstanding-value')).toHaveText('₹0');
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/screenshots/05-clarification.png',fullPage:true});
  await page.getByLabel('Customer',{exact:true}).selectOption({label:'Ramesh · Electrician'});await page.getByRole('button',{name:'Review entry'}).click();await expect(page.getByRole('button',{name:'Confirm & save'})).toBeVisible();await page.getByRole('button',{name:'Cancel preview'}).click();await expect(page.locator('.outstanding-value')).toHaveText('₹0');
});
test('360px viewport, keyboard entry, focus visibility and no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:360,height:740});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/screenshots/06-home-mobile.png',fullPage:true});
  await expect(page.getByRole('button',{name:'Start voice recording'})).toBeVisible();
  expect(await page.getByRole('button',{name:'Start voice recording'}).evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(677);
  expect(await page.getByRole('button',{name:'Enter manually'}).evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(677);
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.getByRole('button',{name:'Enter manually'}).focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByLabel('Customer',{exact:true}).selectOption({label:'Suresh · Book shop'});await dialog.getByLabel('Amount in rupees',{exact:true}).fill('40');
  await page.setViewportSize({width:360,height:460});await dialog.getByRole('button',{name:'Review entry'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Confirm & save'})).toBeVisible();
  await page.getByRole('button',{name:'Confirm & save'}).focus();await page.keyboard.press('Enter');await expect(page.getByText('Saved to SQLite',{exact:true})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);expect(overflow).toBe(false);
  await page.setViewportSize({width:360,height:740});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/screenshots/07-receipt-mobile.png',fullPage:true});
});
test('provider error path retains editable transcript; cancel ignores slow interpretation',async({page})=>{
  // Controlled HTTP failures verify UI handling; these are not live-provider results.
  await page.route('**/api/interpret',async route=>{await new Promise(r=>setTimeout(r,500));await route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({code:'PROVIDER_ERROR',message:'Voice service rejected the request. Manual entry is available.'})});});
  await page.getByText('Type a Hindi or English instruction',{exact:true}).click();await page.getByLabel('Typed input',{exact:true}).fill('Suresh credit 40');await page.getByRole('button',{name:'Review typed instruction'}).click();await expect(page.getByRole('alert')).toContainText('Voice service rejected');await expect(page.getByLabel('Typed input',{exact:true})).toHaveValue('Suresh credit 40');
  await page.unroute('**/api/interpret');
  await page.route('**/api/interpret',async route=>{await new Promise(r=>setTimeout(r,1200));await route.continue().catch(()=>{});});
  await page.getByRole('button',{name:'Review typed instruction'}).click();await page.getByRole('button',{name:'Cancel request'}).click();await manual(page,'Meena · Flower stall','25');await page.waitForTimeout(1500);await expect(page.getByRole('button',{name:'Confirm & save'})).toBeVisible();await expect(page.locator('.preview-view h3')).toHaveText('Meena');await expect(page.locator('.preview-amount')).toHaveText('₹25');await expect(page.locator('.outstanding-value')).toHaveText('₹0');
});
test('uncertain save persists operation, reload recovers original receipt exactly once',async({page})=>{
  await manual(page,'Suresh · Book shop','40');
  await page.route('**/api/proposals/*/confirm',async route=>{await route.fetch();await route.abort('failed');});
  await page.getByRole('button',{name:'Confirm & save'}).click();await expect(page.getByRole('heading',{name:'Check this confirmation'})).toBeVisible();await expect(page.getByRole('alert')).toContainText('Confirmation result unknown');
  await page.unroute('**/api/proposals/*/confirm');await page.reload();await expect(page.getByText('Saved to SQLite',{exact:true})).toBeVisible();await expect(page.locator('.outstanding-value')).toHaveText('₹40');
  await page.getByRole('button',{name:'Done',exact:true}).click();await expect(page.locator('.entry-row')).toHaveCount(1);
});
test('permission denied offers manual fallback without recording',async({page})=>{
  // Only health UI configuration is overridden to reach browser permission handling.
  await page.route('**/api/health',async route=>{const r=await route.fetch();await route.fulfill({response:r,json:{...await r.json(),voiceConfigured:true}});});
  await page.addInitScript(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:()=>Promise.reject(new DOMException('denied','NotAllowedError'))});});
  await page.reload();await page.getByRole('button',{name:'Start voice recording'}).click();await expect(page.getByRole('alert')).toContainText('Microphone permission was denied');await expect(page.getByRole('button',{name:'Enter manually'})).toBeEnabled();await expect(page.locator('.outstanding-value')).toHaveText('₹0');
});
test('real MediaRecorder lifecycle with generated silent stream stops tracks on cancel',async({page})=>{
  // Generated browser audio verifies recording mechanics only; no speech/AI accuracy claim.
  await page.route('**/api/health',async route=>{const r=await route.fetch();await route.fulfill({response:r,json:{...await r.json(),voiceConfigured:true}});});
  await page.addInitScript(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{const audio=new AudioContext();const dest=audio.createMediaStreamDestination();(window as any).__bolTestStream=dest.stream;return dest.stream;}});});
  await page.reload();await page.getByRole('button',{name:'Start voice recording'}).click();await expect(page.getByRole('button',{name:'Stop recording'})).toBeVisible();await page.getByRole('button',{name:'Cancel recording'}).click();
  expect(await page.evaluate(()=>(window as any).__bolTestStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);await expect(page.locator('.outstanding-value')).toHaveText('₹0');
  await page.getByRole('button',{name:'Start voice recording'}).click();await expect(page.getByRole('button',{name:'Stop recording'})).toBeVisible();await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Customers'}).click();expect(await page.evaluate(()=>(window as any).__bolTestStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);
});
test('20-second recorder cap stops tracks; real unconfigured API fails without a fabricated transcript',async({page})=>{
  await page.route('**/api/health',async route=>{const r=await route.fetch();await route.fulfill({response:r,json:{...await r.json(),voiceConfigured:true}});});
  await page.addInitScript(()=>{Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{const audio=new AudioContext();const dest=audio.createMediaStreamDestination();(window as any).__bolTestStream=dest.stream;return dest.stream;}});});
  await page.reload();await page.getByRole('button',{name:'Start voice recording'}).click();await expect(page.getByRole('button',{name:'Stop recording'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('npm run setup:local',{timeout:27000});
  expect(await page.evaluate(()=>(window as any).__bolTestStream.getTracks().every((t:MediaStreamTrack)=>t.readyState==='ended'))).toBe(true);await expect(page.locator('.outstanding-value')).toHaveText('₹0');await expect(page.getByRole('button',{name:'Confirm & save'})).toHaveCount(0);
});
