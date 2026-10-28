import { expect, test, type Page } from '@playwright/test';
import { login, STAFF } from './helpers';
async function staff(page:Page){const request=page.waitForRequest(r=>r.url().includes('/api/cockpit')&&!!r.headers()['authorization']);await login(page,STAFF);return {Authorization:(await request).headers()['authorization']};}
async function fresh(page:Page,headers:Record<string,string>){const date=new Date();date.setDate(date.getDate()+2);const r=await page.request.post('/api/journeys',{headers,data:{patient:{first_name:'Amal',last_name:'Test '+Date.now(),birth_date:'14/03/1986',informed:true},surgery_date:date.toISOString().slice(0,10),procedure:'Démonstration fictive'}});expect(r.ok()).toBeTruthy();return r.json();}
test('guided demo: actual PDF upload, local reading and human validation',async({page})=>{
 await staff(page);await page.goto('/demo');await page.getByRole('button',{name:'Lancer la démonstration'}).click();await page.getByRole('button',{name:'Déposer la pièce fictive'}).click();
 await expect(page.getByLabel('Résultat de lecture')).toContainText('Mutuelle / assurance');await expect(page.getByText('Fin de validité',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:"J'ai vérifié : valider la pièce"}).click();await expect(page.getByText('Dossier administratif complet : 100 %')).toBeVisible();await page.screenshot({path:'../../docs/screenshots/13-guided-demo.png',fullPage:true});
});
test('simulator plays without changing real dossiers',async({page})=>{
 const h=await staff(page);const before=await (await page.request.get('/api/journeys',{headers:h})).json();await page.goto('/concepteur');const option=page.getByLabel('Version').locator('option').filter({hasText:/^Chirurgie ambulatoire.*— v1$/});await page.getByLabel('Version').selectOption({label:(await option.textContent())!});await page.getByRole('button',{name:'Tester ce parcours'}).click();await page.getByRole('button',{name:'Lancer la simulation'}).click();await expect(page.getByLabel('Étape simulée')).toBeVisible();await page.getByLabel('Étape simulée').fill('1');await expect(page.getByText('Pièce manquante → proposition de relance, validation humaine')).toBeVisible();const after=await (await page.request.get('/api/journeys',{headers:h})).json();expect(after.total).toBe(before.total);await page.screenshot({path:'../../docs/screenshots/14-simulator.png',fullPage:true});
});
test('copilot previews then prepares drafts without sending',async({page})=>{
 const h=await staff(page);await fresh(page,h);const messages=await (await page.request.get('/api/messages',{headers:h})).json();await page.goto('/copilote');await page.getByRole('button',{name:'Voir les actions proposées'}).click();await expect(page.getByRole('button',{name:'Préparer ces brouillons'})).toBeVisible();await page.screenshot({path:'../../docs/screenshots/15-copilot.png',fullPage:true});await page.getByRole('button',{name:'Préparer ces brouillons'}).click();await page.getByRole('button',{name:'Confirmer la préparation'}).click();await expect(page.getByText(/brouillon\(s\) préparé\(s\)/)).toBeVisible();expect((await (await page.request.get('/api/messages',{headers:h})).json()).length).toBe(messages.length);
});
test('live dossier reflects another client validation without reload',async({page})=>{
 const h=await staff(page);const j=await fresh(page,h);await page.goto(`/parcours/${j.id}`);await expect(page.getByText('0 %',{exact:true})).toBeVisible();await page.waitForResponse(r=>r.url().includes('/api/live/revision'));const d=await (await page.request.get(`/api/journeys/${j.id}/detail`,{headers:h})).json();expect((await page.request.post(`/api/tasks/${d.documents[0].id}/complete`,{headers:h})).ok()).toBeTruthy();await expect(page.getByText('20 %',{exact:true})).toBeVisible({timeout:10000});
});
test('patient assistant: Darija source and human handoff',async({page,browser})=>{
 const h=await staff(page);const j=await fresh(page,h);const invite=await (await page.request.post(`/api/journeys/${j.id}/invite`,{headers:h})).json();const ctx=await browser.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();await p.goto(invite.link);await p.getByLabel('Date de naissance (JJ/MM/AAAA)').fill('14/03/1986');await p.getByRole('button',{name:'Continuer'}).click();await p.getByRole('button',{name:"J'ai lu et j'accepte"}).click();await p.getByRole('button',{name:'Messages',exact:true}).click();await p.getByLabel("Langue de l'assistant").selectOption('darija');await p.getByLabel('Votre question').fill('شنو الوراق المطلوبة؟');await p.getByRole('button',{name:'سيفط',exact:true}).click();await expect(p.getByText(/Source : Déposer une pièce administrative/)).toBeVisible();await p.screenshot({path:'../../docs/screenshots/16-darija-assistant.png',fullPage:true});await p.getByLabel('Votre question').fill('عندي وجع شنو الدوا؟');await p.getByRole('button',{name:'سيفط',exact:true}).click();await expect(p.getByText('هاد السؤال طبي.',{exact:false})).toBeVisible();await p.getByRole('button',{name:'حول السؤال للفريق'}).click();await expect(p.getByText('تسيفط السؤال للفريق.')).toBeVisible();await page.goto('/communications');await expect(page.getByText('عندي وجع شنو الدوا؟').first()).toBeVisible();await ctx.close();
});

test('voice: recorded synthetic audio is transcribed locally and remains editable',async({page,browser})=>{
 test.skip(!process.env.E2E_AUDIO_FIXTURE,'Set the synthetic audio fixture to exercise microphone capture.');
 const h=await staff(page);const j=await fresh(page,h);const invite=await (await page.request.post(`/api/journeys/${j.id}/invite`,{headers:h})).json();
 const ctx=await browser.newContext();const p=await ctx.newPage();await p.goto(invite.link);await p.getByLabel('Date de naissance (JJ/MM/AAAA)').fill('14/03/1986');await p.getByRole('button',{name:'Continuer'}).click();await p.getByRole('button',{name:"J'ai lu et j'accepte"}).click();await p.getByRole('button',{name:'Messages',exact:true}).click();
 await expect(p.getByRole('button',{name:'Dicter',exact:true})).toBeEnabled();
 await p.getByRole('button',{name:'Dicter',exact:true}).click();await p.waitForTimeout(6500);await p.getByRole('button',{name:'Arrêter',exact:true}).click();
 await expect(p.getByText("Vérifiez et corrigez la transcription avant d'envoyer.")).toBeVisible({timeout:45000});
 await expect(p.getByLabel('Votre question')).not.toHaveValue('');
 // No chat turn was sent automatically: patient must review and send.
 await expect(p.getByText(/Source :/)).toHaveCount(0);
 await ctx.close();
});
