import { avecCors } from '../lib/cors.js';
import { proposerMorceaux } from '../lib/musique.js';

// Propose les morceaux d'une playlist de séance (la playlist est créée par l'appli, dans le compte Spotify de l'utilisateur)
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' });
  try {
    const { seance, style, sansParoles, eviter } = req.body || {};
    if (!Array.isArray(seance?.phases) || !seance.phases.length) return res.status(400).json({ erreur: 'Séance requise' });
    const texte = (t, n) => (typeof t === 'string' ? t.slice(0, n) : null);
    const propre = {
      style: texte(seance.style, 80), niveau: texte(seance.niveau, 40), titre: texte(seance.titre, 120), intention: texte(seance.intention, 300),
      phases: seance.phases.slice(0, 12).map((ph) => ({
        phase: texte(ph.phase, 40) || 'Phase',
        minutes: Math.max(0, Math.min(180, Number(ph.minutes) || 0)),
        postures: Array.isArray(ph.postures) ? ph.postures.slice(0, 6).map((p) => texte(p, 60)).filter(Boolean) : [],
      })),
    };
    const resultat = await proposerMorceaux({
      seance: propre,
      style: texte(style, 80) || 'Relaxation',
      sansParoles: Boolean(sansParoles),
      eviter: Array.isArray(eviter) ? eviter.map((t) => texte(t, 120)).filter(Boolean).slice(0, 80) : [],
    });
    return res.status(200).json(resultat);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erreur: e.message });
  }
}

export default avecCors(handler);
