import { avecCors } from '../lib/cors.js';
import { genererFiche, ficheStockee } from '../lib/fiche.js';
import { supabaseConfigure, utilisateurDepuisRequete } from '../lib/supabase.js';

// POST { id, style?, niveau?, regenerer? }
// - renvoie la fiche en base si elle existe (aucun appel à Gemini) ;
// - sinon la génère et l'enregistre automatiquement (sans validation) ;
// - regenerer : réservé aux admins connectés, remplace la fiche existante.
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' });
  try {
    const { id, style, niveau, regenerer } = req.body || {};
    if (!id) return res.status(400).json({ erreur: 'id requis' });

    const existante = await ficheStockee(id);
    if (existante && !regenerer) return res.status(200).json(existante);

    if (regenerer && supabaseConfigure()) {
      const user = await utilisateurDepuisRequete(req);
      if (!user?.admin) return res.status(403).json({ erreur: 'Connectez-vous avec un compte admin pour régénérer une fiche.' });
    }

    const fiche = await genererFiche({ id, style, niveau });
    return res.status(200).json(fiche);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erreur: e.message });
  }
}

export default avecCors(handler);
