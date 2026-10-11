// Client Supabase du navigateur : clé PUBLIABLE uniquement (protégée par la RLS).
// Sans configuration (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY), l'appli
// fonctionne en mode local : bibliothèque JSON et stockage dans le navigateur.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && cle
  ? createClient(url, cle, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const supabaseActif = Boolean(supabase);

// Jeton de la session en cours, pour les appels aux fonctions /api qui vérifient l'admin
export async function enteteAuth() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  return jeton ? { Authorization: `Bearer ${jeton}` } : {};
}

export async function connexionParEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

// Les administrateurs se connectent avec un mot de passe (pas de lien par email)
export async function connexionParMotDePasse(email, motDePasse) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: motDePasse });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message);
}

export async function deconnexion() {
  if (supabase) await supabase.auth.signOut();
}
