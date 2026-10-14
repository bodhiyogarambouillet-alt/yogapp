// Séance en cours en notification Android « Live Update » (plugin natif SeanceLive, android/.../SeanceLivePlugin.java).
// L'appli envoie le plan de la séance et où elle en est ; la notification avance seule d'une posture à l'autre.
// Sur le site : rien.
import { registerPlugin } from '@capacitor/core';
import { estNatif } from './natif.js';

const SeanceLive = estNatif ? registerPlugin('SeanceLive') : null;
let autorisation = null; // demandée une seule fois

// Réglage (page Compte) : notification pendant la séance, activée par défaut ; disponible dans l'appli Android seulement
export const notifDisponible = Boolean(SeanceLive);
const CLE = 'yoga:notif-seance';
export const notifSeance = () => { try { return localStorage.getItem(CLE) !== 'non'; } catch { return true; } };
export const enregistrerNotifSeance = (oui) => { try { localStorage.setItem(CLE, oui ? 'oui' : 'non'); } catch { /* stockage indisponible */ } };
// Demande l'autorisation d'Android ; renvoie true si les notifications sont permises
export async function autoriserNotifications() {
  if (!SeanceLive) return false;
  try { return Boolean((await SeanceLive.autoriser())?.autorise); } catch { return false; }
}

// etat : { etapes: [{ nom, phase, cotes, secondes }], index, restant (s), enCours }
export async function afficherSeanceLive(etat) {
  if (!SeanceLive || !notifSeance()) return;
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
