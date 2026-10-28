import {test,expect,type Page} from '@playwright/test';
async function prepareCapture(page:Page){await page.locator('img').evaluateAll(async imgs=>{await Promise.all(imgs.map(async el=>{const im=el as HTMLImageElement;im.loading='eager';await im.decode().catch(()=>{});}));});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(600);}


test('public landing has no authentication redirect or patient API requests',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/api/')||r.url().includes('/protocol/openid-connect'))requests.push(r.url())});
 await page.goto('/');await expect(page.getByRole('heading',{level:1})).toContainText('Chaque patient mérite');
 await expect(page.locator('.lp-path-grid>a')).toHaveCount(9);await expect(page.locator('.lp-path-grid .active')).toContainText('Premier parcours MVP');
 await page.locator('.lp-dashboard').evaluate((el:HTMLImageElement)=>el.decode());await expect(page.locator('.lp-dashboard')).toBeVisible();
 expect(requests).toEqual([]);await prepareCapture(page);await page.screenshot({path:'../../docs/screenshots/19a-landing-hero.png'});await page.screenshot({path:'../../docs/screenshots/19-landing-desktop.png',fullPage:true});
});

test('Arabic is complete, RTL and survives reload',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Passer en arabe'}).click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByRole('heading',{level:1})).toContainText('كل مريض');
 await expect(page.locator('.lp-path-grid>a')).toHaveCount(9);await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','ar');
 await prepareCapture(page);await page.screenshot({path:'../../docs/screenshots/20-landing-arabic.png',fullPage:true});await page.getByRole('button',{name:'Passer en français'}).click();await expect(page.locator('html')).toHaveAttribute('dir','ltr');
});

test('product walkthrough, illustrative approvals and privacy work',async({page})=>{
 await page.goto('/');await page.getByRole('tab',{name:/Inviter le patient/}).click();await expect(page.getByRole('tabpanel').locator('img')).toHaveAttribute('src','/marketing/patient.png');
 await page.getByRole('button',{name:'Approuver',exact:true}).click();await expect(page.getByRole('status')).toContainText('dans cette illustration');
 await page.locator('.lp-legal-links').getByRole('button',{name:'Confidentialité'}).click();await expect(page.getByRole('dialog')).toContainText('ne transmet pas les champs du formulaire');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByText('Comment demander une démonstration ?', {exact:true}).click();await expect(page.locator('details[open]')).toContainText('yassine.aqejjaj@gmail.com');
 await page.getByRole('textbox',{name:'Votre nom'}).fill('Équipe démo');await page.getByRole('textbox',{name:'Établissement',exact:true}).fill('Clinique fictive');await page.getByRole('textbox',{name:'E-mail professionnel'}).fill('demo@example.com');await expect(page.getByRole('button',{name:'Préparer ma demande par e-mail'})).toBeEnabled();
});

test('mobile navigation and layout stay within viewport in both languages',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Menu',exact:true}).click();await page.locator('.lp-nav').getByRole('link',{name:'Les parcours',exact:true}).click();await expect(page.locator('.lp-nav')).not.toHaveClass(/open/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await prepareCapture(page);await page.screenshot({path:'../../docs/screenshots/21-landing-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Passer en arabe'}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.lp-header').getByRole('button',{name:'Menu',exact:true}).click();await expect(page.locator('.lp-nav')).toHaveClass(/open/);
});
