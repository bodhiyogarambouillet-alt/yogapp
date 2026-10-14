// Séance en cours en notification Android « Live Update » (plugin natif SeanceLive, android/.../SeanceLivePlugin.java).
// L'appli envoie le plan de la séance et où elle en est ; la notification avance seule d'une posture à l'autre.
// Sur le site : rien.
import { registerPlugin } from '@capacitor/core';
import { estNatif } from './natif.js';

const SeanceLive = estNatif ? registerPlugin('SeanceLive') : null;
let autorisation = null; // demandée une seule fois

// etat : { etapes: [{ nom, phase, cotes, secondes }], index, restant (s), enCours }
export async function afficherSeanceLive(etat) {
  if (!SeanceLive) return;
  try {
    autorisation ??= SeanceLive.autoriser().catch(() => null);
    await autorisation;
    await SeanceLive.afficher(etat);
  } catch { /* notification indisponible : la séance continue */ }
}

export function arreterSeanceLive() {
  SeanceLive?.arreter().catch(() => {});
}

// Boutons de la notification : « pause » (pause / reprise) et « suivante »
export function ecouterActionsSeance(rappel) {
  if (!SeanceLive) return () => {};
  const abonnement = SeanceLive.addListener('action', (d) => rappel(d.action));
  return () => { abonnement.then((a) => a.remove()).catch(() => {}); };
}
