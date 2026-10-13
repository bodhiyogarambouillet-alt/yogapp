// Voix guide de la séance en direct.
// Voix naturelle : chaque annonce est préparée à l'avance par /api/voix (Gemini → MP3 en cache sur Supabase)
// puis jouée comme un son. Repli : synthèse vocale du téléphone (module natif sur Android, la WebView ne
// sachant pas parler seule) ou du navigateur, pour une annonce pas encore prête ou hors connexion.
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { estNatif } from './natif.js';
import { urlApi } from './api.js';

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

function jouer(url) {
  return new Promise((resoudre, rejeter) => {
    lecteur = new Audio(url);
    lecteur.onended = resoudre;
    lecteur.onpause = resoudre; // interrompue par taire()
    lecteur.play().catch(rejeter);
  });
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
  for (const t of liste) {
    if (moi !== jeton) return;
    const son = sons.get(t);
    let dit = false;
    if (son) {
      try { await jouer(son); dit = true; } catch { /* lecture refusée : repli sur la voix du téléphone */ }
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
