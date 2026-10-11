// Fiche « Comment faire ? » générée par Gemini à partir des données de la bibliothèque.
// Les précautions affichées viennent TOUJOURS de la bibliothèque, pas de Gemini.
// Avec Supabase : une fiche par posture, partagée par tous les appareils (cache + validation).

import { callGemini, hasGeminiKey } from './gemini.js';
import { chargerPostures, lireFicheStockee, enregistrerFicheGeneree, supabaseConfigure } from './supabase.js';

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

// Fiche déjà en base (générée ou validée), sinon null
export async function ficheStockee(id) {
  const ligne = await lireFicheStockee(id);
  if (!ligne) return null;
  return { id, mode: 'gemini', ...ligne.contenu, statut: ligne.statut, modele: ligne.modele, source: 'base' };
}

export async function genererFiche({ id, style, niveau }) {
  const postures = await chargerPostures();
  const p = postures.find((x) => x.id === id);
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
Contexte : ${supabaseConfigure()
    // Fiche partagée entre toutes les séances : consignes valables pour un cours tous publics
    ? 'fiche de référence, valable pour un cours tous publics (les adaptations passent par les variantes)'
    : `cours de ${style || 'Hatha'}, niveau ${niveau || 'Intermédiaire'}`}.

Rédige la fiche « Comment faire ? ».`;
  const { donnees, modele } = await callGemini({
    system: SYSTEM, prompt, schema: SCHEMA_FICHE, temperature: 0.4,
    delaiMs: Number(process.env.GEMINI_DELAI_FICHE_MS) || 12000,
  });
  const contenu = {
    entree: donnees.entree || [], alignement: donnees.alignement || [],
    respiration: donnees.respiration || '', sortie: donnees.sortie || '',
    variante_facilitee: donnees.variante_facilitee || '', variante_avancee: donnees.variante_avancee || '',
  };
  await enregistrerFicheGeneree(id, contenu, modele).catch((e) => console.warn(`[fiche] non enregistrée : ${e.message}`));
  return { id, mode: 'gemini', modele, statut: 'generee', source: supabaseConfigure() ? 'base' : 'directe', ...contenu };
}
