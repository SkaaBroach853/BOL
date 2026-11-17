import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
test('automated accessibility on Home, manual entry and mobile viewport',async({page})=>{
  await page.goto('/');await expect(page.getByText('Local ledger connected',{exact:true})).toBeVisible();
  const results=[];
  results.push({screen:'Home desktop',result:await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()});
  await page.getByRole('button',{name:'Enter manually'}).click();results.push({screen:'Manual entry dialog',result:await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()});await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Customers'}).click();results.push({screen:'Customers',result:await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()});
  await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Activity'}).click();results.push({screen:'Activity',result:await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()});
  await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Dashboard'}).click();results.push({screen:'Dashboard',result:await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()});
  await page.getByRole('button',{name:'Settings & help'}).click();results.push({screen:'Settings dialog',result:await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()});await page.getByRole('button',{name:'Close dialog'}).click();
  await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('button',{name:'Home',exact:true}).click();
  await page.setViewportSize({width:360,height:740});results.push({screen:'Home mobile',result:await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()});
  writeFileSync('docs/accessibility-results.json',JSON.stringify(results.map(({screen,result})=>({screen,violations:result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),passes:result.passes.length,incomplete:result.incomplete.length})),null,2));
  expect(results.flatMap(r=>r.result.violations.map(v=>({screen:r.screen,id:v.id,nodes:v.nodes.map(n=>n.target)})))).toEqual([]);
});
