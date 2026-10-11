// Intègre un export de fiches validées dans la bibliothèque de l'appli (src/data/fiches.json).
// Ces fiches deviennent la référence sur tous les appareils après le prochain déploiement.
// Usage : npm run import-fiches chemin/vers/fiches-validees-AAAA-MM-JJ.json
// Une fiche déjà présente avec le même identifiant est remplacée.

import { readFileSync, writeFileSync } from 'node:fs';

const fichier = process.argv[2];
if (!fichier) {
  console.error('Indiquez le fichier exporté : npm run import-fiches ~/Downloads/fiches-validees-….json');
  process.exit(1);
}

const postures = JSON.parse(readFileSync('src/data/postures.json', 'utf8'));
const parId = new Map(postures.map((p) => [p.id, p]));
const existantes = JSON.parse(readFileSync('src/data/fiches.json', 'utf8'));

const donnees = JSON.parse(readFileSync(fichier, 'utf8'));
const brutes = donnees.fiches || donnees;

const champsTexte = ['respiration', 'sortie', 'variante_facilitee', 'variante_avancee'];
let ajoutees = 0;
let remplacees = 0;
const ignorees = [];

for (const [id, f] of Object.entries(brutes)) {
  if (!parId.has(id)) { ignorees.push(`${id} (posture inconnue)`); continue; }
  if (!Array.isArray(f?.entree) || f.entree.length === 0) { ignorees.push(`${id} (fiche vide)`); continue; }
  const fiche = {
    id,
    mode: 'gemini',
    entree: f.entree,
    alignement: Array.isArray(f.alignement) ? f.alignement : [],
    ...Object.fromEntries(champsTexte.map((k) => [k, f[k] || ''])),
  };
  if (existantes[id]) remplacees++; else ajoutees++;
  existantes[id] = fiche;
}

// Tri par identifiant pour des différences lisibles dans git
const triees = Object.fromEntries(Object.keys(existantes).sort().map((k) => [k, existantes[k]]));
writeFileSync('src/data/fiches.json', JSON.stringify(triees, null, 1));

console.log(`${ajoutees} fiche(s) ajoutée(s), ${remplacees} remplacée(s) — ${Object.keys(triees).length} fiche(s) de référence au total.`);
if (ignorees.length) console.warn(`Ignorées : ${ignorees.join(', ')}`);
