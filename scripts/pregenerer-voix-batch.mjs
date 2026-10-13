// Pré-génération de la voix naturelle en un seul lot (API Batch de Gemini : moitié prix, quotas séparés).
// Mêmes segments et mêmes noms de fichiers que scripts/pregenerer-voix.mjs : l'appli retrouve les voix.
//   npm run pregenerer-voix-batch            → envoie tous les segments manquants, attend, puis enregistre
//   npm run pregenerer-voix-batch -- --test 2 → essai sur 2 segments
//   npm run pregenerer-voix-batch -- --reprendre batches/xxx → récupère un lot déjà envoyé
import structures from '../src/data/structures.json' with { type: 'json' };
import posturesLocales from '../src/data/postures.json' with { type: 'json' };
import { rest, supabaseConfigure } from './supabase-admin.mjs'; // charge aussi .env.local
import { MODELE, VOIX, BUCKET, TON, versMp3, cheminVoix, voixExiste } from '../lib/voix.js';
import { envoyerFichier, assurerBucket } from '../lib/supabase.js';
import { ROLES_VOIX, PHRASES_FIXES, phrase, segmentNom, segmentDuree } from '../src/voix-texte.js';

if (!supabaseConfigure) throw new Error('Supabase non configuré (.env.local)');
const API = 'https://generativelanguage.googleapis.com/v1beta';
const entetes = { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY };
const voix = VOIX[0];
const arg = (nom) => { const i = process.argv.indexOf(nom); return i > 0 ? process.argv[i + 1] : null; };

async function segmentsManquants(limite) {
  const postures = await rest('postures?select=*&order=id').catch(() => posturesLocales);
  const dureeDefaut = (p) => (p.minutes ? `${p.minutes} min` : p.respirations ? `${p.respirations} respirations` : '');
  const phases = [...new Set(Object.values(structures.styles).flat().map((x) => x.phase)), 'Pic'];
  const tous = [...new Set([
    ...Object.values(PHRASES_FIXES), ...Object.values(ROLES_VOIX), ...phases.map(phrase),
    ...postures.map((p) => segmentDuree(dureeDefaut(p), p.cotes)),
    ...postures.map(segmentNom),
  ].filter(Boolean))];
  const manquants = [];
  for (let i = 0; i < tous.length; i += 20) {
    const lot = tous.slice(i, i + 20);
    const existe = await Promise.all(lot.map((t) => voixExiste(t, voix)));
    lot.forEach((t, k) => { if (!existe[k]) manquants.push(t); });
  }
  console.log(`${tous.length} segments, ${manquants.length} manquants`);
  return limite ? manquants.slice(0, limite) : manquants;
}

async function envoyer(textes) {
  const r = await fetch(`${API}/models/${MODELE}:batchGenerateContent`, {
    method: 'POST', headers: entetes,
    body: JSON.stringify({ batch: { display_name: `voix-yoga-${Date.now()}`, input_config: { requests: { requests: textes.map((t, i) => ({
      request: {
        contents: [{ parts: [{ text: `${TON}\n\n${t}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voix } } } },
      },
      metadata: { key: String(i) },
    })) } } } }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Batch refusé ${r.status} : ${JSON.stringify(d).slice(0, 400)}`);
  console.log(`Lot envoyé : ${d.name}`);
  return d.name;
}

async function attendre(nom) {
  for (;;) {
    const r = await fetch(`${API}/${nom}`, { headers: entetes });
    const d = await r.json();
    const etat = d.metadata?.state || d.state;
    if (!/SUCCEEDED/.test(etat)) process.stdout.write('.');
    if (/SUCCEEDED/.test(etat)) return d;
    if (/FAILED|CANCELLED|EXPIRED/.test(etat)) throw new Error(`Lot ${etat} : ${JSON.stringify(d.error || {}).slice(0, 300)}`);
    await new Promise((ok) => setTimeout(ok, 30000));
  }
}

async function enregistrer(resultat, textes) {
  const reponses = resultat.response?.inlinedResponses?.inlinedResponses || resultat.metadata?.output?.inlinedResponses?.inlinedResponses || [];
  await assurerBucket(BUCKET);
  let ok = 0;
  let echecs = 0;
  for (const rep of reponses) {
    const t = textes[Number(rep.metadata?.key)];
    const audio = rep.response?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!t || !audio) { echecs++; continue; }
    const taux = Number(/rate=(\d+)/.exec(audio.mimeType || '')?.[1]) || 24000;
    const pcm = Buffer.from(audio.data, 'base64');
    const mp3 = versMp3({ echantillons: new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2)), taux });
    await envoyerFichier(BUCKET, cheminVoix(t, voix), mp3, 'audio/mpeg');
    ok++;
  }
  console.log(`Enregistrés : ${ok}, sans audio : ${echecs} (relancer le script pour les compléter)`);
}

// Lots de 15 segments : les réponses audio reviennent intégrées à la réponse, qui doit rester de taille raisonnable.
// Tous les lots sont envoyés d'abord (Google les traite en parallèle), puis récupérés un par un.
const TAILLE_LOT = 15;
const textes = await segmentsManquants(Number(arg('--test')) || 0);
if (!textes.length) { console.log('Rien à générer.'); process.exit(0); }
if (arg('--reprendre')) {
  await enregistrer(await attendre(arg('--reprendre')), textes.slice(0, TAILLE_LOT));
} else {
  const lots = [];
  for (let i = 0; i < textes.length; i += TAILLE_LOT) {
    const morceau = textes.slice(i, i + TAILLE_LOT);
    lots.push({ nom: await envoyer(morceau), morceau });
  }
  for (const [k, { nom, morceau }] of lots.entries()) {
    console.log(`Lot ${k + 1}/${lots.length}`);
    try {
      await enregistrer(await attendre(nom), morceau);
    } catch (e) {
      console.log(`Lot ${k + 1} : ${e.message}`);
    }
  }
  console.log('Terminé.');
}
