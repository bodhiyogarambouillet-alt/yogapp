// Voix guide de la séance en direct : synthèse vocale du téléphone (appli Android) ou du navigateur (site).
// L'appli Android passe par un module natif : la WebView ne sait pas parler seule.
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { estNatif } from './natif.js';

// Niveaux de guidage : aucun, nom de la posture seulement, ou nom + consignes
export const NIVEAUX_VOIX = [
  ['non', 'Voix coupée'],
  ['nom', 'Voix : postures'],
  ['consignes', 'Voix : postures et consignes'],
];
const CLE = 'yoga:voix';
export const niveauVoix = () => { try { return localStorage.getItem(CLE) || 'consignes'; } catch { return 'consignes'; } };
export const enregistrerNiveauVoix = (n) => { try { localStorage.setItem(CLE, n); } catch { /* stockage indisponible */ } };

let voixWeb = null;
function choisirVoixWeb() {
  if (voixWeb || !window.speechSynthesis) return voixWeb;
  const fr = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('fr'));
  // Les voix « naturelles » ou Google sonnent mieux que les voix système de base
  voixWeb = fr.find((v) => /natural|google|amélie|audrey|thomas/i.test(v.name)) || fr[0] || null;
  return voixWeb;
}
if (!estNatif && window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voixWeb = null; choisirVoixWeb(); };

// Dit un texte ; par défaut interrompt ce qui était en cours
export async function parler(texte, { interrompre = true } = {}) {
  const t = (texte || '').replace(/\s+/g, ' ').trim();
  if (!t) return;
  try {
    if (estNatif) {
      if (interrompre) await TextToSpeech.stop().catch(() => {});
      await TextToSpeech.speak({ text: t, lang: 'fr-FR', rate: 0.92, pitch: 1, volume: 1, category: 'playback' });
      return;
    }
    if (!window.speechSynthesis) return;
    if (interrompre) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'fr-FR';
    u.rate = 0.92;
    const v = choisirVoixWeb();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch { /* synthèse vocale indisponible : la séance continue sans voix */ }
}

export function taire() {
  try {
    if (estNatif) TextToSpeech.stop().catch(() => {});
    else window.speechSynthesis?.cancel();
  } catch { /* rien à arrêter */ }
}

// Durée lue à voix haute : « 5 respirations », « 3 min » → « 3 minutes »
const dureeLue = (d) => (d || '').replace(/\bmin\b/g, 'minutes').replace(/\bresp\.?\b/g, 'respirations').replace(/×\s*(\d+)/, '$1 fois');

// Annonce d'une posture : phase (si elle change), nom, durée, côté, puis consignes selon le niveau
export function annoncePosture({ etape, fiche, nouvellePhase, niveau }) {
  const p = etape.posture;
  const morceaux = [];
  if (nouvellePhase) morceaux.push(`${etape.phase}.`);
  morceaux.push(`${p.fr}.`);
  if (etape.duree) morceaux.push(`${dureeLue(etape.duree)}${p.cotes ? ' de chaque côté' : ''}.`);
  if (p.cotes) morceaux.push('Côté droit.');
  if (niveau === 'consignes') {
    const consignes = fiche?.resume?.length ? fiche.resume : (fiche?.alignement || []).slice(0, 3);
    consignes.forEach((c) => morceaux.push(c.endsWith('.') ? c : `${c}.`));
    if (fiche?.souffle_court) morceaux.push(fiche.souffle_court);
    if (etape.note) morceaux.push(etape.note);
  }
  return morceaux.join(' ');
}
