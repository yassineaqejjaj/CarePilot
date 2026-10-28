import { test, expect } from '@playwright/test';
import { login, STAFF } from './helpers';

test('nine pathways and new Moroccan identity are visible',async({page})=>{
 await login(page,STAFF);
 await expect(page.getByText('M3aya Santé',{exact:true}).first()).toBeVisible();
 await page.getByRole('link',{name:'Catalogue de parcours'}).click();
 await expect(page.getByText('9 modèles de référence')).toBeVisible();
 await expect(page.getByRole('button',{name:'Explorer le parcours'})).toHaveCount(9);
 await page.locator('aside').first().evaluate(el=>el.scrollTop=0);await page.screenshot({path:'../../docs/screenshots/17-catalogue-m3aya.png',fullPage:true});
 await page.getByRole('tab',{name:'Examens',exact:true}).click();
 await expect(page.getByRole('button',{name:'Explorer le parcours'})).toHaveCount(2);
 await page.getByLabel('Rechercher un parcours').fill('IRM');
 await expect(page.getByRole('button',{name:'Explorer le parcours'})).toHaveCount(1);
});

test('maternity reference opens an actual dedicated dossier without resetting data',async({page})=>{
 await login(page,STAFF);await page.getByRole('link',{name:'Catalogue de parcours'}).click();
 const card=page.locator('div').filter({has:page.getByRole('heading',{name:'Maternité : admission et séjour',exact:true})}).filter({has:page.getByRole('button',{name:'Explorer le parcours'})});
 await page.getByLabel('Rechercher un parcours').fill('maternité');
 await page.getByRole('button',{name:'Explorer le parcours'}).click();
 await expect(page.getByRole('dialog')).toContainText('Admissions maternité');
 await page.locator('aside').first().evaluate(el=>el.scrollTop=0);await page.screenshot({path:'../../docs/screenshots/18-maternity-pathway.png',fullPage:true});
 await page.getByRole('button',{name:'Voir un dossier exemple'}).click();
 await expect(page.getByRole('heading',{name:'Salma Bennani · Exemple'})).toBeVisible();
 await expect(page.getByText('Modèle : Maternité : admission et séjour J-30 → J+21 · v1')).toBeVisible();
 await expect(page.getByText('Chirurgie ambulatoire',{exact:true})).toHaveCount(0);
});

test('imaging creation and designer select the correct published template',async({page})=>{
 await login(page,STAFF);await page.getByRole('link',{name:'Catalogue de parcours'}).click();await page.getByLabel('Rechercher un parcours').fill('IRM');await page.getByRole('button',{name:'Explorer le parcours'}).click();await page.getByRole('button',{name:'Créer un dossier sur ce modèle'}).click();
 await expect(page.getByLabel('Modèle de parcours')).toHaveValue(/.+/);
 await expect(page.getByLabel('Modèle de parcours').locator('option:checked')).toHaveText('Imagerie médicale J-7 → J+2');
 await expect(page.getByLabel("Date de l'examen")).toBeVisible();
 // Only inspect the form: no patient is created by this test.
 await page.getByRole('button',{name:'Fermer',exact:true}).click();
 await page.getByRole('link',{name:'Adapter dans le concepteur →'}).click();
 await expect(page.getByLabel('Version').locator('option:checked')).toContainText('Imagerie médicale');
 await page.getByRole('button',{name:'Tester ce parcours'}).click();await page.getByRole('button',{name:'Lancer la simulation'}).click();
 await expect(page.getByLabel('Étape simulée')).toBeVisible();
});
