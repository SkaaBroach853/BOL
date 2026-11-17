import {resolve} from 'node:path';
import express from 'express';
import {chromium,expect} from '@playwright/test';
import {LocalSpeechAgent} from '../server/local-speech.ts';
import {Ledger} from '../server/ledger.ts';
import {createApp} from '../server/app.ts';
// Real local application, isolated empty shop; never changes the owner's database.
const speech=new LocalSpeechAgent(),ledger=new Ledger(':memory:');
const app=createApp(ledger,speech);app.use(express.static(resolve('dist')));
const server=app.listen(0,'127.0.0.1');await new Promise<void>(ok=>server.once('listening',ok));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}`);await expect(page.getByText('Local ledger connected',{exact:true})).toBeVisible();
 await page.screenshot({path:'docs/screenshots/studio-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/screenshots/studio-mobile.png',fullPage:true});
 await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.reload();await expect(page.getByText('Local ledger connected',{exact:true})).toBeVisible();
 await context.setOffline(true);await expect(page.getByText('Server disconnected',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Enter manually',exact:true}).click();const dialog=page.getByRole('dialog',{name:'New ledger entry'});
 await dialog.getByLabel('Customer',{exact:true}).selectOption({label:'Meena · Flower stall'});await dialog.getByLabel('Amount in rupees',{exact:true}).fill('125.50');await dialog.getByRole('button',{name:'Save on this device'}).click();await page.reload();
 await expect(page.getByRole('region',{name:'Entries saved on this device'})).toContainText('₹125.50');await expect(page.locator('.outstanding-value')).toHaveText('₹0');
 await page.screenshot({path:'docs/screenshots/studio-offline-queue.png',fullPage:true});
 console.log('Captured actual desktop/mobile and offline-reload queue screens.');
}finally{await browser.close();speech.close();await new Promise<void>(ok=>server.close(()=>ok()));ledger.close();}
