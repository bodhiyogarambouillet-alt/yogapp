// Pré-génère la voix naturelle des segments réutilisables (phases, rôles, phrases fixes, durées par défaut,
// nom et consignes de chaque posture) dans le stockage Supabase, en respectant l'offre gratuite de Gemini
// (quelques requêtes par minute). On peut l'interrompre et le relancer : ce qui existe déjà est sauté.
//   npm run pregenerer-voix
import structures from '../src/data/structures.json' with { type: 'json' };
import posturesLocales from '../src/data/postures.json' with { type: 'json' };
import { rest, supabaseConfigure } from './supabase-admin.mjs'; // charge aussi .env.local
import { voixPour, voixExiste } from '../lib/voix.js';
import { ROLES_VOIX, PHRASES_FIXES, phrase, segmentNom, segmentDuree } from '../src/voix-texte.js';

if (!supabaseConfigure) throw new Error('Supabase non configuré (.env.local)');
// Offre gratuite : 3 requêtes par minute au plus ; avec la facturation activée : VOIX_ESPACEMENT_MS=500 npm run pregenerer-voix
const ESPACEMENT = Number(process.env.VOIX_ESPACEMENT_MS) || 21000;

const postures = await rest('postures?select=*&order=id').catch(() => posturesLocales);
const dureeDefaut = (p) => (p.minutes ? `${p.minutes} min` : p.respirations ? `${p.respirations} respirations` : '');

// Du plus utile au moins utile : petites phrases communes, puis noms, puis consignes
const phases = [...new Set(Object.values(structures.styles).flat().map((x) => x.phase)), 'Pic'];
const segments = [
  ...Object.values(PHRASES_FIXES), ...Object.values(ROLES_VOIX), ...phases.map(phrase),
  ...postures.map((p) => segmentDuree(dureeDefaut(p), p.cotes)),
  ...postures.map(segmentNom),
].filter(Boolean);
const aFaire = [...new Set(segments)];
console.log(`${aFaire.length} segments à vérifier`);

let generes = 0;
let deja = 0;
let arret = false;
for (const [i, t] of aFaire.entries()) {
  if (arret) break;
  if (await voixExiste(t)) { deja++; continue; }
  for (let essai = 0; essai < 4; essai++) {
    try {
      await voixPour(t);
      generes++;
      console.log(`${i + 1}/${aFaire.length} ✓ ${t.slice(0, 60)}`);
      break;
    } catch (e) {
      if (/PerDay/i.test(e.quota || '')) {
        console.log(`Quota du jour atteint après ${generes} segments générés (${deja} existaient déjà). Relancez demain : npm run pregenerer-voix`);
        arret = true;
        break;
      }
      const attente = (e.attendre || 20) * 1000;
      console.log(`  ${e.message.slice(0, 80)} → nouvel essai dans ${Math.round(attente / 1000)} s`);
      await new Promise((ok) => setTimeout(ok, attente));
    }
  }
  await new Promise((ok) => setTimeout(ok, ESPACEMENT));
}
if (!arret) console.log(`Terminé : ${generes} segments générés, ${deja} existaient déjà.`);
