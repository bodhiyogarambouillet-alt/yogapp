import { genererFiche } from '../lib/fiche.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' });
  try {
    const { id, style, niveau } = req.body || {};
    if (!id) return res.status(400).json({ erreur: 'id requis' });
    const fiche = await genererFiche({ id, style, niveau });
    return res.status(200).json(fiche);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erreur: e.message });
  }
}
