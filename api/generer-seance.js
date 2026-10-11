import { avecCors } from '../lib/cors.js';
import { genererSeance } from '../lib/seance.js';
import { ACCESSOIRES } from '../src/accessoires.js';

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' });
  try {
    const { style, styles, accessoires, duree, niveau, theme, cibleId, evites } = req.body || {};
    if (!duree || !niveau) return res.status(400).json({ erreur: 'duree et niveau sont requis' });
    // `styles` : liste (vide = séance libre) ; `style` (texte) accepté pour les anciens clients
    const listeStyles = [...new Set(Array.isArray(styles) ? styles : style ? [style] : [])].filter((s) => typeof s === 'string').slice(0, 20);
    const seance = await genererSeance({ styles: listeStyles, accessoires: Array.isArray(accessoires) ? accessoires.filter((a) => ACCESSOIRES.includes(a)) : null, duree, niveau, theme: (theme || '').slice(0, 500), cibleId: cibleId || null,
      evites: Array.isArray(evites) ? evites.filter((id) => typeof id === 'string').slice(0, 400) : [],
    });
    return res.status(200).json(seance);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erreur: e.message });
  }
}

export default avecCors(handler);
