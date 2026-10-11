import { genererSeance } from '../lib/seance.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' });
  try {
    const { style, duree, niveau, theme, cibleId, evites } = req.body || {};
    if (!style || !duree || !niveau) return res.status(400).json({ erreur: 'style, duree et niveau sont requis' });
    const seance = await genererSeance({ style, duree, niveau, theme: (theme || '').slice(0, 500), cibleId: cibleId || null,
      evites: Array.isArray(evites) ? evites.filter((id) => typeof id === 'string').slice(0, 400) : [],
    });
    return res.status(200).json(seance);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erreur: e.message });
  }
}
