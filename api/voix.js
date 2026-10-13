import { avecCors } from '../lib/cors.js';
import { voixPour } from '../lib/voix.js';

// Annonces vocales de la séance : renvoie l'adresse d'un MP3 par texte (générés puis mis en cache)
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' });
  try {
    const { textes, voix } = req.body || {};
    const liste = (Array.isArray(textes) ? textes : []).filter((t) => typeof t === 'string' && t.trim()).map((t) => t.slice(0, 1200)).slice(0, 6);
    if (!liste.length) return res.status(400).json({ erreur: 'Textes requis' });
    // Une annonce après l'autre : l'offre gratuite de Gemini limite la synthèse vocale à quelques requêtes par minute
    const urls = [];
    let attendre = 0;
    for (const t of liste) {
      if (attendre) { urls.push(null); continue; }
      try {
        urls.push(await voixPour(t, voix));
      } catch (e) {
        console.error(e.message);
        urls.push(null);
        attendre = e.attendre || 0; // quota ou surcharge : on arrête ce lot, l'appli réessaiera
      }
    }
    return res.status(200).json({ urls, attendre });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erreur: e.message });
  }
}

export default avecCors(handler);
