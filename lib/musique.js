// Propositions de morceaux pour la playlist d'une séance (Gemini).
// Gemini propose des titres réels, phase par phase, avec de la marge ; l'appli les vérifie ensuite
// un par un dans le catalogue Spotify, ajuste la durée et complète avec les mots-clés si besoin.

import { callGemini } from './gemini.js';

const SCHEMA_MUSIQUE = {
  type: 'OBJECT',
  properties: {
    phases: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          phase: { type: 'STRING' },
          ambiance: { type: 'STRING', description: 'Ambiance recherchée, quelques mots en français' },
          mots_cles: { type: 'STRING', description: 'Requête de recherche Spotify de secours, en anglais, 2 à 4 mots (genre + ambiance)' },
          morceaux: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { titre: { type: 'STRING' }, artiste: { type: 'STRING' } },
              required: ['titre', 'artiste'],
            },
          },
        },
        required: ['phase', 'mots_cles', 'morceaux'],
      },
    },
  },
  required: ['phases'],
};

const SYSTEM = `Tu es un musicien et professeur de yoga qui compose des playlists pour accompagner des séances.
Règles impératives :
- Ne propose que des morceaux RÉELS, publiés et disponibles sur Spotify, avec le titre exact et l'artiste principal exact. N'invente jamais.
- Respecte le style musical demandé ; varie les artistes (pas plus de deux morceaux du même artiste).
- Suis l'énergie de la séance : très calme au centrage et à la relaxation, plus porté (sans excès) pendant les salutations, postures debout et le pic.
- Pour la relaxation finale : morceaux très lents, sans percussions, idéalement longs.`;

export async function proposerMorceaux({ seance, style, sansParoles, eviter = [] }) {
  const phases = seance.phases.filter((ph) => ph.minutes > 0);
  const prompt = `Séance : ${seance.style || 'yoga'}${seance.niveau ? `, niveau ${seance.niveau}` : ''}${seance.titre ? `, « ${seance.titre} »` : ''}.
${seance.intention ? `Intention : ${seance.intention}` : ''}
Style musical demandé : ${style}.${sansParoles ? ' Uniquement des morceaux instrumentaux (sans paroles).' : ''}
${eviter.length ? `\nNe reprends AUCUN de ces morceaux déjà proposés : ${eviter.slice(0, 80).join(' ; ')}.` : ''}

Phases (dans l'ordre) :
${phases.map((ph) => `- ${ph.phase} : ${ph.minutes} min${ph.postures?.length ? ` (${ph.postures.slice(0, 6).join(', ')})` : ''}`).join('\n')}

Pour chaque phase, propose environ (minutes ÷ 2,5) morceaux (au moins 2), soit nettement plus que nécessaire :
certains seront introuvables et l'appli ajustera la durée. Garde les noms de phase exacts.`;
  const { donnees, modele } = await callGemini({ system: SYSTEM, prompt, schema: SCHEMA_MUSIQUE, temperature: 0.9, delaiMs: Number(process.env.GEMINI_DELAI_SEANCE_MS) || 20000 });
  const parPhase = new Map((donnees.phases || []).map((p) => [p.phase, p]));
  return {
    modele,
    phases: phases.map((ph) => {
      const p = parPhase.get(ph.phase) || {};
      return {
        phase: ph.phase,
        minutes: ph.minutes,
        ambiance: p.ambiance || null,
        motsCles: p.mots_cles || `${style} yoga`,
        morceaux: (p.morceaux || []).filter((m) => m.titre && m.artiste).slice(0, 40),
      };
    }),
  };
}
