import { pingSupabase } from '../lib/supabase.js';

// Appelé chaque jour par le cron Vercel (voir vercel.json) : une lecture sur Supabase
// suffit à éviter la mise en pause d'un projet gratuit après une semaine d'inactivité.
// Si CRON_SECRET est défini dans Vercel, Vercel l'envoie automatiquement et l'appel est vérifié.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ erreur: 'Non autorisé' });
  try {
    return res.status(200).json({ ok: true, ...(await pingSupabase()), le: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, erreur: e.message });
  }
}
