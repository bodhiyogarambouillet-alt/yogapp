// Connexion au compte Spotify de l'utilisateur (OAuth « Authorization Code » avec PKCE : aucun secret dans l'appli).
// Site : redirection vers Spotify puis retour sur /spotify-callback. Appli Android : Spotify s'ouvre dans un
// navigateur intégré, puis revient dans l'appli par le lien fr.bodhiyoga.seances://spotify-callback.
// Les jetons restent sur l'appareil (localStorage) ; seuls les comptes ajoutés dans le tableau de bord
// développeur Spotify (5 au plus) peuvent se connecter.

import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { estNatif } from './natif.js';

const CLIENT_ID = '865f2b060c194907b0e5585908ac1cc6'; // identifiant public de l'appli Spotify
const RETOUR_APPLI = 'fr.bodhiyoga.seances://spotify-callback';
const RETOUR = estNatif ? RETOUR_APPLI : `${window.location.origin}/spotify-callback`;
// Créer les playlists de séance, lancer / mettre en pause la lecture, afficher le morceau en cours
const SCOPES = 'playlist-modify-private playlist-modify-public user-read-playback-state user-modify-playback-state user-read-currently-playing';
const CLE = 'yoga:spotify';
const CLE_ATTENTE = 'yoga:spotify-attente'; // vérificateur PKCE et état, le temps de l'aller-retour chez Spotify

const lire = (cle) => { try { return JSON.parse(localStorage.getItem(cle)); } catch { return null; } };
const ecrire = (cle, v) => { try { if (v) localStorage.setItem(cle, JSON.stringify(v)); else localStorage.removeItem(cle); } catch { /* stockage indisponible */ } };

// ---------- État observable (écran Compte, carte musique…) ----------
const abonnes = new Set();
let erreur = null;
export const etatSpotify = () => ({ connecte: Boolean(lire(CLE)?.refresh), profil: lire(CLE)?.profil || null, erreur });
export function surSpotify(fn) { abonnes.add(fn); return () => abonnes.delete(fn); }
const prevenir = () => abonnes.forEach((fn) => fn(etatSpotify()));

// ---------- PKCE ----------
const base64url = (octets) => btoa(String.fromCharCode(...new Uint8Array(octets))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const aleatoire = (n) => base64url(crypto.getRandomValues(new Uint8Array(n)));

export async function connecterSpotify() {
  erreur = null;
  const verificateur = aleatoire(64);
  const etat = aleatoire(16);
  const defi = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificateur)));
  ecrire(CLE_ATTENTE, { verificateur, etat });
  const url = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    client_id: CLIENT_ID, response_type: 'code', redirect_uri: RETOUR, scope: SCOPES,
    code_challenge_method: 'S256', code_challenge: defi, state: etat,
  })}`;
  if (estNatif) await Browser.open({ url });
  else window.location.assign(url);
}

export function deconnecterSpotify() {
  ecrire(CLE, null);
  erreur = null;
  prevenir();
}

async function demanderJeton(parametres) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...parametres }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.error || `Spotify a répondu ${r.status}`);
  return d;
}

const enregistrerJetons = (d, precedent = {}) => ({
  ...precedent,
  acces: d.access_token,
  refresh: d.refresh_token || precedent.refresh, // Spotify ne renvoie pas toujours un nouveau jeton de rafraîchissement
  expire: Date.now() + (d.expires_in - 60) * 1000,
});

// Retour de Spotify : vérifie l'état, échange le code contre les jetons, puis lit le nom du compte
async function terminerConnexion(params) {
  const attente = lire(CLE_ATTENTE);
  ecrire(CLE_ATTENTE, null);
  try {
    if (params.get('error')) throw new Error(params.get('error') === 'access_denied' ? 'Connexion annulée.' : params.get('error'));
    if (!attente || params.get('state') !== attente.etat || !params.get('code')) throw new Error('Réponse de Spotify inattendue, réessayez.');
    const d = await demanderJeton({ grant_type: 'authorization_code', code: params.get('code'), redirect_uri: RETOUR, code_verifier: attente.verificateur });
    ecrire(CLE, enregistrerJetons(d));
    const moi = await appelSpotify('/me');
    ecrire(CLE, { ...lire(CLE), profil: { nom: moi.display_name || moi.id, id: moi.id, premium: moi.product ? moi.product === 'premium' : null } });
    erreur = null;
  } catch (e) {
    ecrire(CLE, null);
    erreur = e.message;
  }
  prevenir();
}

// Jeton d'accès valide (rafraîchi si besoin)
async function jeton() {
  const j = lire(CLE);
  if (!j?.refresh) throw new Error('Compte Spotify non connecté.');
  if (j.acces && Date.now() < j.expire) return j.acces;
  try {
    const d = await demanderJeton({ grant_type: 'refresh_token', refresh_token: j.refresh });
    ecrire(CLE, enregistrerJetons(d, j));
    return d.access_token;
  } catch (e) {
    deconnecterSpotify(); // jeton expiré ou accès retiré : il faut se reconnecter
    throw new Error(`Connexion Spotify expirée, reconnectez-vous (${e.message}).`);
  }
}

// Appel à l'API Web de Spotify
export async function appelSpotify(chemin, { method = 'GET', body } = {}) {
  const r = await fetch(`https://api.spotify.com/v1${chemin}`, {
    method,
    headers: { Authorization: `Bearer ${await jeton()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204 || r.status === 202) return null;
  const d = await r.json().catch(() => null);
  if (r.status === 403 && !lire(CLE)?.profil) throw new Error("Ce compte Spotify n'est pas autorisé pour l'appli (5 comptes au plus, ajoutés par l'administrateur).");
  if (!r.ok) {
    const e = new Error(d?.error?.message || `Spotify a répondu ${r.status}`);
    e.statut = r.status;
    e.raison = d?.error?.reason || null; // ex. NO_ACTIVE_DEVICE, PREMIUM_REQUIRED
    throw e;
  }
  return d;
}

// ---------- Retours de Spotify ----------
// Site : la page /spotify-callback recharge l'appli ; on termine la connexion puis on revient à l'adresse de base.
export const retourSpotifyWeb = !estNatif && window.location.pathname === '/spotify-callback';
if (retourSpotifyWeb) {
  const params = new URLSearchParams(window.location.search);
  window.history.replaceState(null, '', '/');
  terminerConnexion(params);
}

if (estNatif) {
  App.addListener('appUrlOpen', ({ url: lien }) => {
    if (!lien.startsWith(RETOUR_APPLI)) return;
    Browser.close().catch(() => {});
    terminerConnexion(new URL(lien).searchParams);
  });
}
