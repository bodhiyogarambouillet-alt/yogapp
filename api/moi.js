import { supabaseConfigure, utilisateurDepuisRequete } from '../lib/supabase.js';

// GET : qui est connecté, et est-ce un admin ? (utilisé pour afficher les boutons de validation)
export default async function handler(req, res) {
  try {
    if (!supabaseConfigure()) return res.status(200).json({ supabase: false, user: null });
    const user = await utilisateurDepuisRequete(req);
    return res.status(200).json({ supabase: true, user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erreur: e.message });
  }
}
