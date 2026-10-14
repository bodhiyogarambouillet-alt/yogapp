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
          mots_cles: { type: 'STRING', description: 'Requête de recherche Spotify de secours, en anglais, 2 à 4 mots : le genre + « calm » ou « slow » (ex. « calm acoustic folk »)' },
          morceaux: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                titre: { type: 'STRING' },
                artiste: { type: 'STRING' },
                chante: { type: 'BOOLEAN', description: 'true si le morceau contient du chant ou des paroles (même discrètes), false s\'il est entièrement instrumental' },
              },
              required: ['titre', 'artiste', 'chante'],
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
- TOUS les morceaux sont calmes, lents et méditatifs, quel que soit le style demandé et quelle que soit la phase : tempo lent,
  ambiance douce et apaisante, sans montée d'énergie, sans rythme marqué ni batterie, sans voix criée ou intense.
  Dans un style naturellement énergique (folk, lo-fi, jazz…), ne retiens que ses morceaux les plus doux et les plus lents.
- Les phases plus actives (salutations, postures debout, pic) restent calmes : au plus un léger mouvement, jamais dynamique.
- Pour la relaxation finale : morceaux très lents, sans percussions, idéalement longs.`;

// Vérification neutre de chaque morceau, sans les consignes qui poussent à répondre ce qu'on attend :
// est-il chanté ? est-il calme et méditatif ? Renvoie les morceaux à écarter (en cas d'échec : aucun)
const cleMorceau = (m) => `${m.titre}|${m.artiste}`.toLowerCase();
async function morceauxAEcarter(liste, sansParoles) {
  if (!liste.length) return new Set();
  try {
    const { donnees } = await callGemini({
      system: 'Tu es un discothécaire précis. Tu réponds selon tes connaissances de ces enregistrements, sans deviner.',
      prompt: `Pour chacun de ces morceaux, indique :
- chante : contient-il du chant ou des paroles (même discrètes, chœurs ou voix en fond compris) ? Dans le doute : true.
- calme : est-il calme et méditatif de bout en bout (tempo lent, énergie basse, sans montée en intensité, voix douce s'il est chanté ;
  un rythme léger et feutré, comme en lo-fi, est accepté, mais pas une batterie forte ou dynamique) ? Dans le doute : false.
${liste.map((m, i) => `${i}. ${m.titre} — ${m.artiste}`).join('\n')}`,
      schema: {
        type: 'OBJECT',
        properties: { morceaux: { type: 'ARRAY', items: { type: 'OBJECT', properties: { n: { type: 'INTEGER' }, chante: { type: 'BOOLEAN' }, calme: { type: 'BOOLEAN' } }, required: ['n', 'chante', 'calme'] } } },
        required: ['morceaux'],
      },
      temperature: 0,
      delaiMs: 15000,
    });
    return new Set((donnees.morceaux || [])
      .filter((r) => liste[r.n] && (!r.calme || (sansParoles && r.chante)))
      .map((r) => cleMorceau(liste[r.n])));
  } catch {
    return new Set();
  }
}

// Recherche Spotify de secours (morceaux introuvables) : toujours calme, et conforme à la consigne sur la voix
const motsClesSecours = (mots, sansParoles) => {
  let q = /calm|slow|gentle|soft|peaceful/i.test(mots) ? mots : `calm slow ${mots}`;
  if (!/meditat|relax|sleep|ambient/i.test(q)) q = `${q} meditative`;
  q = q.replace(/\b(instrumental|vocals?|songs?)\b/gi, '').replace(/\s+/g, ' ').trim();
  return sansParoles ? `${q} instrumental` : `${q} vocal songs`;
};

// Consigne sur la voix : sans paroles (instrumental strict) ou avec paroles (une majorité de morceaux chantés)
const consigneVoix = (sansParoles) => (sansParoles
  ? `VOIX : uniquement des morceaux ENTIÈREMENT INSTRUMENTAUX. Aucun chant, aucune parole, aucun mantra ou chœur chanté,
pas de voix même discrète ou en fond. Dans un style surtout chanté (folk, chanson, pop douce…), prends ses formes instrumentales :
guitare acoustique fingerstyle, piano, cordes, ou versions instrumentales officielles (titre contenant « Instrumental »).
Ne propose jamais une chanson connue en la déclarant instrumentale : si tu n'es pas sûr, n'en mets pas.`
  : `VOIX : la playlist est AVEC PAROLES. Au moins deux morceaux sur trois sont chantés (voix douce et posée : folk,
chanson acoustique, chant méditatif…). Indique honnêtement « chante » pour chaque morceau.`);

export async function proposerMorceaux({ seance, style, sansParoles, eviter = [] }) {
  const phases = seance.phases.filter((ph) => ph.minutes > 0);
  const consigne = (aEviter) => `Séance : ${seance.style || 'yoga'}${seance.niveau ? `, niveau ${seance.niveau}` : ''}${seance.titre ? `, « ${seance.titre} »` : ''}.
${seance.intention ? `Intention : ${seance.intention}` : ''}
Style musical demandé : ${style}.
${consigneVoix(sansParoles)}
${aEviter.length ? `\nNe reprends AUCUN de ces morceaux déjà proposés : ${aEviter.slice(0, 120).join(' ; ')}.` : ''}

Phases (dans l'ordre) :
${phases.map((ph) => `- ${ph.phase} : ${ph.minutes} min${ph.postures?.length ? ` (${ph.postures.slice(0, 6).join(', ')})` : ''}`).join('\n')}

Rappel : uniquement des morceaux calmes, lents et méditatifs, même dans ce style.

Pour chaque phase, propose environ (minutes ÷ 2) morceaux (au moins 3), soit nettement plus que nécessaire :
certains seront introuvables ou écartés à la vérification, et l'appli ajustera la durée. Garde les noms de phase exacts.
Les mots-clés de secours respectent aussi la consigne sur la voix (${sansParoles ? 'avec « instrumental »' : 'avec « vocal » ou « songs »'}).`;

  // Un tour : propositions de Gemini, puis vérification à part de chaque morceau (écarte ceux qui ne sont pas calmes
  // et méditatifs et, sans paroles, ceux qui sont chantés : Gemini a tendance à les déclarer conformes)
  const tour = async (aEviter) => {
    const { donnees, modele } = await callGemini({ system: SYSTEM, prompt: consigne(aEviter), schema: SCHEMA_MUSIQUE, temperature: 0.9, delaiMs: Number(process.env.GEMINI_DELAI_SEANCE_MS) || 20000 });
    const parPhase = new Map((donnees.phases || []).map((p) => [p.phase, { ...p, morceaux: (p.morceaux || []).filter((m) => m.titre && m.artiste && !(sansParoles && m.chante)) }]));
    const proposes = [...parPhase.values()].flatMap((p) => p.morceaux);
    const ecartes = await morceauxAEcarter(proposes, sansParoles);
    for (const p of parPhase.values()) p.morceaux = p.morceaux.filter((m) => !ecartes.has(cleMorceau(m)));
    return { modele, parPhase, proposes };
  };

  const premier = await tour(eviter);
  const parPhase = premier.parPhase;
  // Trop peu de morceaux retenus (un par tranche de 4 min environ) : un second tour, sans reprendre les premiers
  const retenus = [...parPhase.values()].reduce((n, p) => n + p.morceaux.length, 0);
  const besoin = Math.ceil(phases.reduce((s, ph) => s + ph.minutes, 0) / 4);
  if (retenus < besoin) {
    try {
      const second = await tour([...eviter, ...premier.proposes.map((m) => `${m.titre} — ${m.artiste}`)]);
      for (const [nomPhase, p] of second.parPhase) {
        const dejaLa = parPhase.get(nomPhase);
        if (dejaLa) dejaLa.morceaux.push(...p.morceaux); else parPhase.set(nomPhase, p);
      }
    } catch { /* second tour indisponible : la recherche de secours complétera */ }
  }

  return {
    modele: premier.modele,
    phases: phases.map((ph) => {
      const p = parPhase.get(ph.phase) || {};
      return {
        phase: ph.phase,
        minutes: ph.minutes,
        ambiance: p.ambiance || null,
        // la recherche de secours reste toujours calme et méditative, et respecte la consigne sur la voix
        motsCles: motsClesSecours(p.mots_cles || style, sansParoles),
        morceaux: (p.morceaux || []).slice(0, 40),
      };
    }),
  };
}
