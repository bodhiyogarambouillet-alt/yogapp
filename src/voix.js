// Voix guide de la séance en direct.
// Voix naturelle : chaque annonce est préparée à l'avance par /api/voix (Gemini → MP3 en cache sur Supabase)
// puis jouée comme un son. Repli : synthèse vocale du téléphone (module natif sur Android, la WebView ne
// sachant pas parler seule) ou du navigateur, pour une annonce pas encore prête ou hors connexion.
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { estNatif } from './natif.js';
import { urlApi } from './api.js';
import { MODELE_VOIX, VOIX_DEFAUT, TON_VOIX } from './voix-texte.js';

// ---------- Fichiers audio : adresse recalculée sur l'appareil, copie locale pour le hors connexion ----------
const BASE_STOCKAGE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const CACHE_VOIX = 'yoga-voix';
// Même empreinte que le serveur (lib/voix.js) : sha256 de « modèle|voix|ton|texte », 32 premiers caractères
async function urlCalculee(texte) {
  const octets = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${MODELE_VOIX}|${VOIX_DEFAUT}|${TON_VOIX}|${texte}`));
  const hex = [...new Uint8Array(octets)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return `${BASE_STOCKAGE}/storage/v1/object/public/voix/${VOIX_DEFAUT}/${hex}.mp3`;
}
async function copieLocale(url) {
  try { return await (await caches.open(CACHE_VOIX)).match(url); } catch { return null; }
}

// ---------- Voix naturelle : préparation et lecture ----------
const sons = new Map(); // texte → adresse du MP3
const enPreparation = new Set(); // textes déjà demandés au serveur
let lecteur = null; // son en cours

// Prépare les annonces de la séance, par lots (chaque lot est généré en parallèle côté serveur)
export async function preparerVoix(textes, progression = () => {}) {
  const aFaire = [...new Set(textes.filter((t) => t && !sons.has(t) && !enPreparation.has(t)))];
  aFaire.forEach((t) => enPreparation.add(t));
  let fait = textes.length - aFaire.length;
  progression({ fait, total: textes.length });
  // Une annonce à la fois ; si le serveur signale un quota atteint, on patiente puis on reprend (3 essais au plus)
  for (const t of aFaire) {
    for (let essai = 0; essai < 3 && !sons.has(t); essai++) {
      try {
        const r = await fetch(urlApi('/api/voix'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ textes: [t] }) });
        const d = await r.json();
        if (d.urls?.[0]) sons.set(t, d.urls[0]);
        else if (d.attendre) await new Promise((ok) => setTimeout(ok, Math.min(d.attendre, 60) * 1000));
        else break;
      } catch { break; /* hors connexion : la voix du téléphone prendra le relais */ }
    }
    enPreparation.delete(t);
    progression({ fait: ++fait, total: textes.length });
  }
}

// Récupère tout de suite les voix manquantes d'une annonce (déjà générées pour la plupart : réponse immédiate),
// sans attendre plus de quelques secondes ; ce qui n'arrive pas à temps sera dit par la voix du téléphone
async function assurerSons(textes) {
  if (!navigator.onLine) return;
  const manquants = [];
  for (const t of new Set(textes)) if (!sons.has(t) && !(await copieLocale(await urlCalculee(t)))) manquants.push(t);
  for (let i = 0; i < manquants.length; i += 6) {
    const lot = manquants.slice(i, i + 6);
    const arret = new AbortController();
    const minuteur = setTimeout(() => arret.abort(), 6000);
    try {
      const r = await fetch(urlApi('/api/voix'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ textes: lot }), signal: arret.signal,
      });
      const d = await r.json();
      (d.urls || []).forEach((u, k) => { if (u) sons.set(lot[k], u); });
    } catch { /* délai dépassé ou hors connexion */ } finally { clearTimeout(minuteur); }
  }
}

// Joue un fichier audio : la copie locale s'il y en a une (hors connexion), sinon depuis le stockage
async function jouer(url) {
  const local = await copieLocale(url);
  const source = local ? URL.createObjectURL(await local.blob()) : url;
  return new Promise((resoudre, rejeter) => {
    lecteur = new Audio(source);
    const fin = () => { if (local) URL.revokeObjectURL(source); };
    lecteur.onended = () => { fin(); resoudre(); };
    lecteur.onpause = () => { fin(); resoudre(); }; // interrompue par taire()
    lecteur.onerror = () => { fin(); rejeter(new Error('audio indisponible')); };
    lecteur.play().catch(rejeter);
  });
}

// ---------- Séance disponible hors connexion ----------
const CLE_HORS_LIGNE = 'yoga:hors-ligne';
export const horsLigne = (uid) => { try { return JSON.parse(localStorage.getItem(CLE_HORS_LIGNE) || '{}')[uid] || null; } catch { return null; } };

// Télécharge les voix d'une liste de segments dans la mémoire de l'appli (les génère d'abord si besoin)
export async function telechargerVoix(uid, textes, progression = () => {}) {
  const liste = [...new Set(textes.filter(Boolean))];
  await preparerVoix(liste, () => {}); // s'assure que chaque voix existe (génère les phrases propres à la séance)
  const cache = await caches.open(CACHE_VOIX);
  let fait = 0;
  let manquants = 0;
  for (const t of liste) {
    const url = sons.get(t) || await urlCalculee(t);
    if (!(await cache.match(url))) {
      try {
        const r = await fetch(url);
        if (r.ok) await cache.put(url, r); else manquants++;
      } catch { manquants++; }
    }
    progression({ fait: ++fait, total: liste.length });
  }
  try {
    const tout = JSON.parse(localStorage.getItem(CLE_HORS_LIGNE) || '{}');
    tout[uid] = { le: new Date().toISOString(), voix: liste.length - manquants, manquants };
    localStorage.setItem(CLE_HORS_LIGNE, JSON.stringify(tout));
  } catch { /* stockage indisponible */ }
  return { manquants };
}

// Niveaux de guidage : aucun, nom de la posture seulement, ou nom + consignes
export const NIVEAUX_VOIX = [
  ['non', 'Voix coupée'],
  ['nom', 'Voix : postures'],
  ['consignes', 'Voix : postures et consignes'],
];
// Coupée à chaque ouverture du lecteur : la voix (et la génération des annonces par Gemini) ne démarre
// que si on l'active pendant la séance. Le dernier niveau choisi est seulement retenu pour la réactivation.
const CLE = 'yoga:voix-niveau';
export const niveauVoix = () => 'non';
export const dernierNiveauVoix = () => { try { return localStorage.getItem(CLE) || 'consignes'; } catch { return 'consignes'; } };
export const enregistrerNiveauVoix = (n) => { try { if (n !== 'non') localStorage.setItem(CLE, n); localStorage.removeItem('yoga:voix'); } catch { /* stockage indisponible */ } };

let voixWeb = null;
function choisirVoixWeb() {
  if (voixWeb || !window.speechSynthesis) return voixWeb;
  const fr = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('fr'));
  // Les voix « naturelles » ou Google sonnent mieux que les voix système de base
  voixWeb = fr.find((v) => /natural|google|amélie|audrey|thomas/i.test(v.name)) || fr[0] || null;
  return voixWeb;
}
if (!estNatif && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voixWeb = null; choisirVoixWeb(); };

// Voix du téléphone (ou du navigateur) pour un segment ; la promesse se termine à la fin de la phrase
async function direSysteme(t) {
  try {
    if (estNatif) {
      await TextToSpeech.speak({ text: t, lang: 'fr-FR', rate: 0.92, pitch: 1, volume: 1, category: 'playback' });
      return;
    }
    if (!window.speechSynthesis) return;
    await new Promise((fin) => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'fr-FR';
      u.rate = 0.92;
      const v = choisirVoixWeb();
      if (v) u.voice = v;
      u.onend = fin;
      u.onerror = fin;
      window.speechSynthesis.speak(u);
    });
  } catch { /* synthèse vocale indisponible : la séance continue sans voix */ }
}

let jeton = 0; // change à chaque nouvelle annonce ou silence : la lecture en cours s'arrête
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Dit une annonce (un texte ou une liste de segments), segment après segment :
// voix naturelle pour les segments prêts, voix du téléphone pour les autres ; interrompt ce qui était en cours
export async function parler(segments) {
  const liste = (Array.isArray(segments) ? segments : [segments]).map((t) => (t || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!liste.length) return;
  taire();
  const moi = ++jeton;
  await assurerSons(liste);
  for (const t of liste) {
    if (moi !== jeton) return;
    // Adresse confirmée par le serveur, sinon recalculée sur l'appareil (copie locale ou fichier déjà généré)
    const son = sons.get(t) || await urlCalculee(t);
    let dit = false;
    if (moi === jeton && (sons.has(t) || navigator.onLine || await copieLocale(son))) {
      try { await jouer(son); dit = true; } catch { /* fichier absent ou lecture refusée : repli sur la voix du téléphone */ }
    }
    if (!dit && moi === jeton) await direSysteme(t);
    if (moi === jeton) await pause(220); // courte respiration entre deux segments
  }
}

export function taire() {
  jeton++;
  if (lecteur) { lecteur.pause(); lecteur = null; }
  try {
    if (estNatif) TextToSpeech.stop().catch(() => {});
    else window.speechSynthesis?.cancel();
  } catch { /* rien à arrêter */ }
}

// Annonce d'une posture, en segments (voir voix-texte.js)
export { segmentsAnnonce, PHRASES_FIXES } from './voix-texte.js';
