// Fiche « Comment faire ? » générée par Gemini à partir des données de la bibliothèque.
// Les précautions affichées viennent TOUJOURS de la bibliothèque, pas de Gemini.

import postures from '../src/data/postures.json' with { type: 'json' };
import { callGemini, hasGeminiKey } from './gemini.js';

const BY_ID = new Map(postures.map((p) => [p.id, p]));

const SCHEMA_FICHE = {
  type: 'OBJECT',
  properties: {
    entree: { type: 'ARRAY', items: { type: 'STRING' }, description: '3 à 5 étapes pour s\'installer' },
    alignement: { type: 'ARRAY', items: { type: 'STRING' }, description: '2 ou 3 repères clés' },
    respiration: { type: 'STRING' },
    sortie: { type: 'STRING' },
    variante_facilitee: { type: 'STRING' },
    variante_avancee: { type: 'STRING' },
  },
  required: ['entree', 'alignement', 'respiration', 'sortie', 'variante_facilitee', 'variante_avancee'],
};

const SYSTEM = `Tu es un professeur de yoga qui rédige des consignes claires, sûres et concises pour guider une posture.
- Français, vouvoiement, phrases courtes et concrètes, vocabulaire de cours de yoga.
- Ne contredis jamais les précautions fournies et n'invente pas de bénéfices thérapeutiques.
- Pas de diagnostic ni de promesse médicale.
- Adapte le ton au style de cours indiqué (ex. prénatal, De Gasquet : expiration active, périnée remonté, pas de poussée vers le bas).`;

export async function genererFiche({ id, style, niveau }) {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Posture inconnue : ${id}`);
  if (!hasGeminiKey()) {
    return {
      id, mode: 'hors-ligne',
      entree: ['Consignes indisponibles : ajoutez GEMINI_API_KEY pour les générer.'],
      alignement: [], respiration: '', sortie: '', variante_facilitee: '', variante_avancee: '',
    };
  }
  const prompt = `Posture : ${p.fr}${p.sanskrit ? ` (${p.sanskrit})` : ''} — ${p.en}
Famille : ${p.famille} · Niveau : ${p.niveau} · ${p.cotes ? 'se fait des deux côtés' : 'symétrique'}
Zones sollicitées : ${p.zones?.length ? p.zones.join(', ') : 'non renseignées'}
Accessoires possibles : ${p.accessoires || 'aucun'}
Précautions de la bibliothèque : ${p.precautions || 'aucune'}
Contexte du cours : ${style || 'Hatha'}, niveau ${niveau || 'Intermédiaire'}.

Rédige la fiche « Comment faire ? ».`;
  const { donnees, modele } = await callGemini({
    system: SYSTEM, prompt, schema: SCHEMA_FICHE, temperature: 0.4,
    delaiMs: Number(process.env.GEMINI_DELAI_FICHE_MS) || 12000,
  });
  return { id, mode: 'gemini', modele, ...donnees };
}
