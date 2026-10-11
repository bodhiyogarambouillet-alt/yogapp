// Régénère src/data/postures.json à partir du tableau Excel,
// puis, si Supabase est configuré dans .env.local, synchronise la table `postures`.
// Usage : npm run import-bibliotheque [chemin/vers/fichier.xlsx]
// Par défaut : scripts/bibliotheque-postures-yoga.xlsx (onglet « Postures »).

import { readFileSync, writeFileSync } from 'node:fs';
import XLSX from 'xlsx';
import { supabaseConfigure, rest, upsert } from './supabase-admin.mjs';

const fichier = process.argv[2] || 'scripts/bibliotheque-postures-yoga.xlsx';
const wb = XLSX.read(readFileSync(fichier));
const ws = wb.Sheets['Postures'];
if (!ws) throw new Error('Onglet « Postures » introuvable');
const lignes = XLSX.utils.sheet_to_json(ws, { defval: null });

// Colonnes de styles du tableau → noms utilisés dans l'appli
const STYLES = {
  'Hatha': 'Hatha', 'Vinyasa': 'Vinyasa', 'Ashtanga': 'Ashtanga', 'Iyengar': 'Iyengar',
  'Sivananda': 'Sivananda', 'Yin': 'Yin', 'Restauratif': 'Restauratif', 'Kundalini': 'Kundalini',
  'De Gasquet': 'De Gasquet', 'Prénatal': 'Prénatal', 'Postnatal': 'Postnatal',
  'Doux / seniors / chaise': 'Doux / seniors', 'Yoga du dos': 'Yoga du dos', 'Power yoga': 'Power yoga',
};
const txt = (v) => (v === null || v === undefined || String(v).trim() === '' || v === '—' ? null : String(v).trim());
const num = (v) => (v === null || v === '' ? null : Number(v));
// Listes : « ; » pour les postures (préparations, contre-postures), « , » pour les zones
const liste = (v, sep = ';') => (txt(v) ? String(v).split(sep).map((s) => s.trim()).filter(Boolean) : []);
// Accepte les anciens noms de colonnes (v2/v3) et les nouveaux (v4)
const col = (l, ...noms) => { for (const n of noms) if (n in l) return l[n]; return null; };

const postures = lignes
  .filter((l) => txt(l['Nom français']))
  .map((l, i) => ({
    id: txt(l['ID']) || `P${String(i + 1).padStart(3, '0')}`,
    sanskrit: txt(l['Nom sanskrit']),
    fr: txt(l['Nom français']),
    en: txt(l['Nom anglais']),
    famille: txt(l['Famille']),
    niveau: num(l['Niveau (1-3)']) || 1,
    styles: Object.entries(STYLES).filter(([col]) => txt(l[col])?.toLowerCase() === 'x').map(([, nom]) => nom),
    phase: txt(l['Phase du cours']),
    respirations: num(l['Tenue (respirations)']),
    minutes: num(l['Tenue lente (min) yin / restauratif']),
    cotes: txt(l['Côtés']) === 'Oui',
    accessoires: txt(l['Accessoires']),
    zones: liste(col(l, 'Zones sollicitées'), ','),
    preparations: liste(col(l, 'Préparations', 'Préparation')),
    contres: liste(col(l, 'Contre-postures', 'Contre-posture')),
    precautions: txt(l['Précautions / variantes']),
  }));

// Contrôle : chaque préparation / contre-posture doit exister dans le tableau
const noms = new Set(postures.map((p) => p.fr.toLowerCase()));
const inconnues = [];
for (const p of postures) {
  for (const n of [...p.preparations, ...p.contres]) if (!noms.has(n.toLowerCase())) inconnues.push(`${p.fr} → « ${n} »`);
}

writeFileSync('src/data/postures.json', JSON.stringify(postures, null, 1));
console.log(`${postures.length} postures importées dans src/data/postures.json`);
if (inconnues.length) {
  console.warn(`\n⚠ ${inconnues.length} référence(s) introuvable(s) (vérifiez l'orthographe exacte du nom français) :`);
  inconnues.forEach((m) => console.warn(`  - ${m}`));
}

// ---------- Synchronisation Supabase ----------
if (process.argv.includes('--sans-supabase')) process.exit(0);
if (!supabaseConfigure) {
  console.log('\nSupabase non configuré dans .env.local : seule la copie locale (JSON) est à jour.');
} else {
  await upsert('postures', postures, 'id');
  console.log(`✓ ${postures.length} postures synchronisées dans Supabase.`);
  // Les postures supprimées du tableau ne sont pas effacées de la base (des séances peuvent y faire référence)
  const enBase = await rest('postures?select=id,fr');
  const ids = new Set(postures.map((p) => p.id));
  const orphelines = enBase.filter((p) => !ids.has(p.id));
  if (orphelines.length) {
    console.warn(`⚠ ${orphelines.length} posture(s) en base absente(s) du tableau (non supprimées) : ${orphelines.map((p) => `${p.id} ${p.fr}`).join(', ')}`);
  }
}
