// Pré-génère avec Gemini les fiches « Comment faire ? » manquantes, dans un fichier relisible,
// puis (2e étape) les importe dans Supabase.
//
//   npm run pregenerer-fiches             → écrit scripts/fiches-pregenerees.json
//                                            (reprend là où il s'est arrêté si on le relance)
//   npm run pregenerer-fiches -- --import  → envoie le fichier dans la table `fiches`
//   (ajoutez --forcer pour remplacer aussi les fiches retouchées à la main)
//
// Fiches visées : postures sans fiche, et fiches d'un ancien format jamais retouchées par un admin.
// Les fiches modifiées à la main (valide_par renseigné) ne sont jamais remplacées.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rest, upsert, supabaseConfigure } from './supabase-admin.mjs'; // charge aussi .env.local
import { redigerFiche, VERSION_FICHE } from '../lib/fiche.js';
import { hasGeminiKey } from '../lib/gemini.js';

const SORTIE = 'scripts/fiches-pregenerees.json';
const EN_PARALLELE = 3;

if (!supabaseConfigure) throw new Error('Supabase non configuré : renseignez SUPABASE_URL et SUPABASE_SECRET_KEY dans .env.local.');
const lire = () => (existsSync(SORTIE) ? JSON.parse(readFileSync(SORTIE, 'utf8')) : {});
const ecrire = (fiches) => writeFileSync(SORTIE, JSON.stringify(
  Object.fromEntries(Object.keys(fiches).sort().map((k) => [k, fiches[k]])), null, 1,
));

// ---------- Import ----------
if (process.argv.includes('--import')) {
  const fiches = lire();
  const enBase = new Map((await rest('fiches?select=posture_id,valide_par')).map((f) => [f.posture_id, f]));
  const lignes = Object.entries(fiches)
    // ne jamais écraser une fiche retouchée par un admin, sauf avec --forcer
    .filter(([id]) => process.argv.includes('--forcer') || !enBase.get(id)?.valide_par)
    .map(([id, { posture: _p, modele, ...contenu }]) => ({ posture_id: id, contenu, statut: 'validee', modele }));
  await upsert('fiches', lignes, 'posture_id');
  console.log(`✓ ${lignes.length} fiche(s) importée(s) dans Supabase.`);
  process.exit(0);
}

// ---------- Génération ----------
if (!hasGeminiKey()) throw new Error('GEMINI_API_KEY manquante dans .env.local.');
const postures = await rest('postures?select=*&order=id');
const enBase = new Map((await rest('fiches?select=posture_id,valide_par,contenu')).map((f) => [f.posture_id, f]));
const fiches = lire();
const aFaire = postures.filter((p) => {
  if (fiches[p.id]) return false; // déjà pré-générée
  const f = enBase.get(p.id);
  return !f || (!f.valide_par && (f.contenu?.version || 1) < VERSION_FICHE);
});
console.log(`${postures.length} postures · ${enBase.size} fiches en base · ${Object.keys(fiches).length} déjà pré-générées · ${aFaire.length} à générer`);

let faites = 0;
const echecs = [];
async function travailleur() {
  while (aFaire.length) {
    const p = aFaire.shift();
    try {
      const { contenu, modele } = await redigerFiche({ ...p, minutes: p.minutes === null ? null : Number(p.minutes) });
      fiches[p.id] = { posture: p.sanskrit || p.fr, modele, ...contenu };
      ecrire(fiches); // sauvegarde au fil de l'eau : relancer reprend où on s'est arrêté
      console.log(`✓ ${++faites} ${p.id} ${p.sanskrit || p.fr}`);
    } catch (e) {
      echecs.push(p.id);
      console.warn(`✗ ${p.id} ${p.fr} : ${e.message.slice(0, 120)}`);
    }
  }
}
await Promise.all(Array.from({ length: EN_PARALLELE }, travailleur));
console.log(`\n${faites} fiche(s) écrite(s) dans ${SORTIE}.${echecs.length ? ` Échecs (relancez le script) : ${echecs.join(', ')}` : ''}`);
console.log('Relisez le fichier, puis : npm run pregenerer-fiches -- --import');
