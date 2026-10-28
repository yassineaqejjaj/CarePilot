import {test,expect,type Page} from '@playwright/test';
import {login,PATIENT} from './helpers';
async function ready(page:Page){await page.goto('/app');await page.locator('#username').waitFor();await page.locator('.home-brand img').evaluate((im:HTMLImageElement)=>im.decode());await page.evaluate(()=>document.fonts.ready);}

test('branded login preserves the native Keycloak form and accessible controls',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await ready(page);
 await expect(page.getByRole('heading',{name:'Heureux de vous retrouver.'})).toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang','fr');
 await expect(page.locator('#kc-form-login')).toHaveAttribute('method','post');await expect(page.locator('#kc-form-login')).toHaveAttribute('action',/\/login-actions\/authenticate/);
 await expect(page.locator('#username')).toHaveAttribute('autocomplete','username');await expect(page.locator('#password')).toHaveAttribute('autocomplete','current-password');
 const user=await page.locator('#username').boundingBox();const submit=await page.locator('#kc-login').boundingBox();expect(user?.height).toBeGreaterThanOrEqual(48);expect(submit?.height).toBeGreaterThanOrEqual(48);
 await page.screenshot({path:'../../docs/screenshots/22-authentication-fr.png',fullPage:true});
});

test('Arabic login is RTL and password visibility keeps native functionality',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await ready(page);await page.getByRole('link',{name:'العربية',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByRole('heading',{name:'سعداء بعودتكم.'})).toBeVisible();
 await page.getByRole('button',{name:'إظهار كلمة المرور'}).click();await expect(page.locator('#password')).toHaveAttribute('type','text');await page.getByRole('button',{name:'إخفاء كلمة المرور'}).click();await expect(page.locator('#password')).toHaveAttribute('type','password');
 await page.screenshot({path:'../../docs/screenshots/23-authentication-ar.png',fullPage:true});
});

test('mobile login is readable and has no horizontal overflow in either language',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page);await expect(page.locator('#kc-login')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#username')).toBeFocused();
 await page.screenshot({path:'../../docs/screenshots/24-authentication-mobile.png',fullPage:true});await page.getByRole('link',{name:'العربية',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.setViewportSize({width:320,height:700});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#kc-login')).toBeVisible();
});

test('invalid login displays the native generic error without changing real accounts',async({page})=>{
 await ready(page);await page.locator('#username').fill('nonexistent-theme-check');await page.locator('#password').fill('invalid-test-value');await page.locator('#kc-login').click();await expect(page.locator('#input-error')).toBeVisible();await expect(page.locator('#input-error')).toContainText('incorrect');await expect(page.locator('#username')).toHaveAttribute('aria-invalid','true');await expect(page.locator('#password')).toHaveAttribute('type','password');await expect(page.locator('#kc-login')).toBeEnabled();
});

test('existing patient credentials still open the patient portal',async({page})=>{
 await login(page,PATIENT);await expect(page.getByText('Votre préparation',{exact:true})).toBeVisible();
});

test('Arabic public website carries its language through to Keycloak',async({page})=>{
 await page.goto('/?lang=ar');await page.locator('.lp-login').click();await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByRole('heading',{name:'سعداء بعودتكم.'})).toBeVisible();
});
