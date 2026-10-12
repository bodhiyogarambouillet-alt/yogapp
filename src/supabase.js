// Client Supabase du navigateur : clé PUBLIABLE uniquement (protégée par la RLS).
// Sans configuration (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY), l'appli
// fonctionne en mode local : bibliothèque JSON et stockage dans le navigateur.

import { createClient } from '@supabase/supabase-js';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { estNatif } from './natif.js';
import { alerter } from './components/Dialogue.jsx';

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && cle
  ? createClient(url, cle, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null;

export const supabaseActif = Boolean(supabase);

// Jeton de la session en cours, pour les appels aux fonctions /api qui vérifient l'admin
export async function enteteAuth() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  return jeton ? { Authorization: `Bearer ${jeton}` } : {};
}

// Seuls les administrateurs se connectent (email + mot de passe) : eux seuls peuvent enregistrer les fiches
export async function connexionParMotDePasse(email, motDePasse) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: motDePasse });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message);
}

// ---------- Connexion avec Google ----------
// Site : redirection classique vers Google puis retour sur le site (le code est échangé automatiquement).
// Appli Android : Google s'ouvre dans un navigateur intégré, puis revient dans l'appli par ce lien.
const RETOUR_APPLI = 'fr.bodhiyoga.seances://login-callback';

export async function connexionGoogle() {
  if (estNatif) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: RETOUR_APPLI, skipBrowserRedirect: true },
    });
    if (error) throw error;
    await Browser.open({ url: data.url });
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  if (error) throw error;
}

if (estNatif && supabase) {
  App.addListener('appUrlOpen', async ({ url: lien }) => {
    if (!lien.startsWith(RETOUR_APPLI)) return;
    Browser.close().catch(() => {});
    const code = new URL(lien).searchParams.get('code');
    if (code) await supabase.auth.exchangeCodeForSession(code).catch((e) => alerter({ titre: 'Connexion Google impossible', message: e.message }));
  });
}

export async function deconnexion() {
  if (supabase) await supabase.auth.signOut();
}
