// Fiche « Comment faire ? » générée par Gemini à partir des données de la bibliothèque.
// Les précautions affichées viennent TOUJOURS de la bibliothèque, pas de Gemini.
// Avec Supabase : une fiche par posture, partagée par tous les appareils (cache + validation).

import { callGemini, hasGeminiKey } from './gemini.js';
import { chargerPostures, lireFicheStockee, enregistrerFicheGeneree, supabaseConfigure } from './supabase.js';

// Version du format de fiche : une fiche générée dans un format plus ancien (et jamais
// modifiée à la main) est régénérée automatiquement à sa prochaine ouverture.
export const VERSION_FICHE = 2;

const LISTES = ['entree', 'alignement', 'tenue', 'erreurs'];
const TEXTES = ['presentation', 'respiration', 'sortie', 'variante_facilitee', 'variante_avancee'];

const SCHEMA_FICHE = {
  type: 'OBJECT',
  properties: {
    presentation: { type: 'STRING', description: '2 ou 3 phrases : forme de la posture, ce qu\'on y recherche, place dans la séance' },
    entree: { type: 'ARRAY', items: { type: 'STRING' }, description: '5 à 8 étapes détaillées pour s\'installer, des appuis jusqu\'à la position finale' },
    alignement: { type: 'ARRAY', items: { type: 'STRING' }, description: '4 à 6 repères, des appuis vers la tête : pieds, jambes, bassin, colonne, épaules, regard' },
    tenue: { type: 'ARRAY', items: { type: 'STRING' }, description: '2 à 4 consignes pendant le maintien : ce qui reste actif, où porter l\'attention, sensations attendues' },
    erreurs: { type: 'ARRAY', items: { type: 'STRING' }, description: '2 à 4 erreurs fréquentes, chacune suivie de sa correction' },
    respiration: { type: 'STRING', description: '2 phrases : rythme et rôle de l\'inspiration et de l\'expiration dans la posture' },
    sortie: { type: 'STRING', description: '2 ou 3 phrases : étapes pour sortir, ce qui suit (autre côté, posture de repos)' },
    variante_facilitee: { type: 'STRING', description: 'Variante accessible, avec accessoires si utile' },
    variante_avancee: { type: 'STRING', description: 'Variante plus exigeante, sans sortir de la sécurité' },
  },
  required: [...TEXTES, ...LISTES],
};

const SYSTEM = `Tu es un professeur de yoga qui rédige des consignes claires, sûres et concises pour guider une posture.
- Français, vouvoiement, phrases courtes et concrètes, vocabulaire de cours de yoga.
- Sois précis et détaillé : placement des appuis, direction des mouvements, engagement musculaire, repères visuels ou sensoriels.
- Nommez la posture par son nom sanskrit quand il existe.
- Ne contredis jamais les précautions fournies et n'invente pas de bénéfices thérapeutiques.
- Pas de diagnostic ni de promesse médicale.
- Adapte le ton au style de cours indiqué (ex. prénatal, De Gasquet : expiration active, périnée remonté, pas de poussée vers le bas).`;

// Fiche déjà en base (générée ou validée), sinon null
export async function ficheStockee(id) {
  const ligne = await lireFicheStockee(id);
  if (!ligne) return null;
  // Ancien format jamais retouché par un admin : on laisse le serveur la régénérer
  if ((ligne.contenu?.version || 1) < VERSION_FICHE && !ligne.valide_par) return null;
  return { id, mode: 'gemini', ...ligne.contenu, statut: ligne.statut, modele: ligne.modele, source: 'base' };
}

const contenuVide = () => ({
  ...Object.fromEntries(LISTES.map((k) => [k, []])),
  ...Object.fromEntries(TEXTES.map((k) => [k, ''])),
});

export async function genererFiche({ id, style, niveau }) {
  const postures = await chargerPostures();
  const p = postures.find((x) => x.id === id);
  if (!p) throw new Error(`Posture inconnue : ${id}`);
  if (!hasGeminiKey()) {
    return {
      id, mode: 'hors-ligne',
      ...contenuVide(),
      entree: ['Consignes indisponibles : ajoutez GEMINI_API_KEY pour les générer.'],
    };
  }
  const prompt = `Posture : ${p.sanskrit ? `${p.sanskrit} (${p.fr})` : p.fr} — ${p.en}
Famille : ${p.famille} · Niveau : ${p.niveau} · ${p.cotes ? 'se fait des deux côtés' : 'symétrique'}
Zones sollicitées : ${p.zones?.length ? p.zones.join(', ') : 'non renseignées'}
Accessoires possibles : ${p.accessoires || 'aucun'}
Précautions de la bibliothèque : ${p.precautions || 'aucune'}
Contexte : ${supabaseConfigure()
    // Fiche partagée entre toutes les séances : consignes valables pour un cours tous publics
    ? 'fiche de référence, valable pour un cours tous publics (les adaptations passent par les variantes)'
    : `cours de ${style || 'Hatha'}, niveau ${niveau || 'Intermédiaire'}`}.

Rédige une fiche « Comment faire ? » complète et détaillée.`;
  const { donnees, modele } = await callGemini({
    system: SYSTEM, prompt, schema: SCHEMA_FICHE, temperature: 0.4,
    delaiMs: Number(process.env.GEMINI_DELAI_FICHE_MS) || 20000,
  });
  const contenu = {
    ...Object.fromEntries(LISTES.map((k) => [k, Array.isArray(donnees[k]) ? donnees[k] : []])),
    ...Object.fromEntries(TEXTES.map((k) => [k, donnees[k] || ''])),
    version: VERSION_FICHE,
  };
  await enregistrerFicheGeneree(id, contenu, modele).catch((e) => console.warn(`[fiche] non enregistrée : ${e.message}`));
  return { id, mode: 'gemini', modele, statut: 'validee', source: supabaseConfigure() ? 'base' : 'directe', ...contenu };
}
