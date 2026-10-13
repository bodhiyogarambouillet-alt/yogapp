// Voix naturelle de la séance en direct : Gemini (synthèse vocale) → MP3, mis en cache dans le stockage Supabase.
// Chaque annonce n'est générée qu'une fois (clé = empreinte du texte, de la voix et du ton) puis réutilisée par tous.

import { createHash } from 'node:crypto';
import lamejs from '@breezystack/lamejs';
import { assurerBucket, envoyerFichier, fichierExiste, supabaseConfigure, urlPubliqueStockage } from './supabase.js';

export const MODELE = process.env.GEMINI_MODEL_VOIX || 'gemini-3.1-flash-tts-preview';
// Modèle de secours (quota séparé) si le principal est saturé ou a atteint son quota
const MODELE_SECOURS = process.env.GEMINI_MODEL_VOIX_SECOURS || 'gemini-2.5-flash-preview-tts';
export const VOIX = ['Aoede', 'Leda', 'Kore', 'Charon', 'Puck', 'Fenrir'];
export const BUCKET = 'voix';
export const TON = "Lis ce texte en français, d'une voix calme, douce et posée de professeure de yoga, avec de courtes pauses entre les phrases. Prononce les noms sanskrits des postures correctement, à l'indienne :";

const empreinte = (texte, voix) => createHash('sha256').update(`${MODELE}|${voix}|${TON}|${texte}`).digest('hex').slice(0, 32);

async function synthese(texte, voix) {
  try {
    return await syntheseAvec(MODELE, texte, voix);
  } catch (e) {
    // Saturé, quota atteint, ou réponse sans audio (arrive sur certains textes très courts) : modèle de secours
    if ((e.statut && ![429, 503].includes(e.statut)) || MODELE_SECOURS === MODELE) throw e;
    return syntheseAvec(MODELE_SECOURS, texte, voix);
  }
}

async function syntheseAvec(modele, texte, voix) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${TON}\n\n${texte}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voix } } } },
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(`Gemini voix ${r.status} : ${d.error?.message?.slice(0, 160) || ''}`);
    e.statut = r.status;
    // Quota dépassé (offre gratuite : quelques requêtes par minute) : délai conseillé avant de réessayer
    const delai = (d.error?.details || []).find((x) => x.retryDelay)?.retryDelay;
    e.quota = (d.error?.details || []).flatMap((x) => x.violations || []).map((v) => v.quotaId).join(' ');
    e.attendre = delai ? Math.ceil(parseFloat(delai)) : r.status === 429 ? 30 : r.status === 503 ? 10 : 0;
    throw e;
  }
  const audio = d.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!audio) throw new Error('Gemini n\'a pas renvoyé d\'audio');
  const taux = Number(/rate=(\d+)/.exec(audio.mimeType || '')?.[1]) || 24000;
  const pcm = Buffer.from(audio.data, 'base64');
  return { echantillons: new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2)), taux };
}

export function versMp3({ echantillons, taux }) {
  const enc = new (lamejs.Mp3Encoder || lamejs.default.Mp3Encoder)(1, taux, 64);
  const morceaux = [];
  for (let i = 0; i < echantillons.length; i += 1152 * 20) morceaux.push(enc.encodeBuffer(echantillons.subarray(i, i + 1152 * 20)));
  morceaux.push(enc.flush());
  return Buffer.concat(morceaux.map((m) => Buffer.from(m.buffer, m.byteOffset, m.length)));
}

export const cheminVoix = (texte, voix) => `${voix}/${empreinte(texte, voix)}.mp3`;
export const voixExiste = (texte, voix = VOIX[0]) => fichierExiste(BUCKET, cheminVoix(texte, voix));

let bucketPret = false;
// Renvoie l'adresse du MP3 de cette annonce (générée si besoin)
export async function voixPour(texte, voix = VOIX[0]) {
  if (!supabaseConfigure()) throw new Error('Supabase non configuré');
  const v = VOIX.includes(voix) ? voix : VOIX[0];
  const chemin = cheminVoix(texte, v);
  if (await fichierExiste(BUCKET, chemin)) return urlPubliqueStockage(BUCKET, chemin);
  if (!bucketPret) { await assurerBucket(BUCKET); bucketPret = true; }
  const mp3 = versMp3(await synthese(texte, v));
  await envoyerFichier(BUCKET, chemin, mp3, 'audio/mpeg');
  return urlPubliqueStockage(BUCKET, chemin);
}
