// Génération d'une séance : présélection par le code, composition par Gemini,
// vérification par le code. Sans clé Gemini, un générateur simple prend le relais.
//
// Option « posture cible » : la séance est construite comme une progression
// qui amène à réaliser cette posture en fin de partie active (dernière posture
// de la phase « Pic »), suivie de sa contre-posture et du retour au calme.

import structures from '../src/data/structures.json' with { type: 'json' };
import { callGemini, hasGeminiKey } from './gemini.js';
import { chargerPostures } from './supabase.js';
import { libelleStyles, convientAuxStyles } from '../src/styles-seance.js';
import { faisableAvec, accessoiresManquants } from '../src/accessoires.js';

// Nom affiché : sanskrit d'abord (comme dans l'interface)
const nomAffiche = (p) => p.sanskrit || p.fr;

// Bibliothèque indexée pour une requête (lue depuis Supabase, ou le JSON local en repli)
export function indexer(postures) {
  const BY_ID = new Map(postures.map((p) => [p.id, p]));
  const BY_NOM = new Map(postures.map((p) => [p.fr.toLowerCase(), p]));
  return { postures, BY_ID, parNom: (nom) => (nom ? BY_NOM.get(nom.toLowerCase()) : undefined) };
}

// ---------- Étape 1 : règles strictes (code) ----------

// Ordre des phases quand plusieurs styles sont mélangés
const ORDRE_PHASES = ['Centrage', 'Échauffement', 'Salutations', 'Debout', 'Sol', 'Pic', 'Retour au calme', 'Relaxation'];

// Structure de la séance : celle du style choisi ; pour un mélange, moyenne des structures ;
// sans style, structure équilibrée de Hatha.
function structureDe(styles) {
  const noms = styles.length ? styles : ['Hatha'];
  for (const n of noms) if (!structures.styles[n]) throw new Error(`Style inconnu : ${n}`);
  if (noms.length === 1) return structures.styles[noms[0]].map((p) => ({ ...p }));
  const somme = new Map();
  for (const n of noms) for (const p of structures.styles[n]) somme.set(p.phase, (somme.get(p.phase) || 0) + p.part / noms.length);
  const retenues = [...somme].filter(([, part]) => part >= 0.03);
  const total = retenues.reduce((s, [, part]) => s + part, 0);
  return retenues
    .sort((a, b) => ORDRE_PHASES.indexOf(a[0]) - ORDRE_PHASES.indexOf(b[0]))
    .map(([phase, part]) => ({ phase, part: part / total }));
}

export function planPhases(styles, duree, avecPic = false) {
  let base = structureDe(styles);

  // Une posture cible a besoin d'une phase « Pic » : on l'ajoute si le style n'en a pas,
  // en prenant 10 % du temps sur la phase la plus longue, juste avant le retour au calme.
  if (avecPic && !base.some((p) => p.phase === 'Pic')) {
    const plusLongue = base.reduce((a, b) => (b.part > a.part ? b : a));
    plusLongue.part -= 0.1;
    const iCalme = base.findIndex((p) => p.phase === 'Retour au calme' || p.phase === 'Relaxation');
    base.splice(iCalme === -1 ? base.length : iCalme, 0, { phase: 'Pic', part: 0.1 });
  }

  const phases = base.map((p) => ({ phase: p.phase, minutes: Math.round(p.part * duree) }));
  const ecart = duree - phases.reduce((s, p) => s + p.minutes, 0);
  if (ecart !== 0) {
    const plusLongue = phases.reduce((a, b) => (b.minutes > a.minutes ? b : a));
    plusLongue.minutes += ecart;
  }
  return phases.filter((p) => p.minutes > 0);
}

export function candidats(styles, niveau, bib, accessoires = null) {
  const max = structures.niveaux[niveau]?.max ?? 1;
  return bib.postures.filter((p) => convientAuxStyles(p, styles) && p.niveau <= max && faisableAvec(p, accessoires));
}

const preparationsDe = (p, bib) => (p.preparations || []).map(bib.parNom).filter(Boolean);
export const contrePosture = (p, bib) => (p.contres || []).map(bib.parNom).find(Boolean) || null;

// Chaîne de préparation : les préparations directes de la cible (colonne « Préparations »,
// du plus général au plus proche), précédées de leurs propres préparations (2e niveau).
// Résultat ordonné du plus simple au plus proche de la cible, sans doublon.
const recouvrement = (a, b) => (a.zones || []).filter((z) => (b.zones || []).includes(z)).length;

export function chainePreparation(cible, bib, max = 6) {
  const directes = preparationsDe(cible, bib);
  // 2e niveau : seulement les préparations qui travaillent au moins une zone de la cible
  const indirectes = directes.flatMap((d) => preparationsDe(d, bib)).filter((p) => recouvrement(p, cible) > 0);
  const vus = new Set([cible.id]);
  const uniques = [];
  for (const p of [...directes, ...indirectes]) {
    if (vus.has(p.id)) continue;
    vus.add(p.id);
    uniques.push({ p, direct: directes.includes(p) });
  }
  // Trop long : on garde les préparations directes en priorité
  const retenues = uniques.length > max
    ? [...uniques.filter((x) => x.direct), ...uniques.filter((x) => !x.direct)].slice(0, max)
    : uniques;
  // Ordre de progression : du plus général (peu de zones communes, niveau bas) au plus proche de la cible
  // (à égalité : les préparations de 2e niveau avant les directes)
  return retenues
    .sort((a, b) => recouvrement(a.p, cible) - recouvrement(b.p, cible) || a.p.niveau - b.p.niveau || a.direct - b.direct)
    .map((x) => x.p);
}

// Postures qui travaillent les mêmes zones que la cible, d'un niveau inférieur ou égal
export function posturesProches(cible, liste, exclure = new Set()) {
  return liste
    .filter((p) => p.id !== cible.id && !exclure.has(p.id) && p.niveau <= cible.niveau && recouvrement(p, cible) > 0)
    .map((p) => ({ p, score: recouvrement(p, cible) * 2 + (p.famille === cible.famille ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.p.niveau - b.p.niveau)
    .map((x) => x.p);
}

function ligneCandidat(p) {
  const tenue = p.minutes ? `${p.minutes} min` : p.respirations ? `${p.respirations} resp.` : 'variable';
  return [
    p.id, p.fr, p.famille, `niv ${p.niveau}`, `phase conseillée: ${p.phase}`, `tenue: ${tenue}`,
    p.cotes ? 'deux côtés' : null,
    p.zones?.length ? `zones: ${p.zones.join(', ')}` : null,
    p.preparations?.length ? `prépa: ${p.preparations.join(', ')}` : null,
    p.contres?.length ? `contre-posture: ${p.contres.join(', ')}` : null,
    p.precautions ? `précautions: ${p.precautions}` : null,
  ].filter(Boolean).join(' | ');
}

// ---------- Étape 2 : composition (Gemini) ----------

const SCHEMA_SEANCE = {
  type: 'OBJECT',
  properties: {
    titre: { type: 'STRING' },
    intention: { type: 'STRING' },
    phases: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          phase: { type: 'STRING' },
          postures: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                duree: { type: 'STRING', description: 'Ex. "5 respirations", "3 min", "× 3 tours"' },
                note: { type: 'STRING', description: 'Consigne courte facultative (transition, adaptation, lien avec la posture cible)' },
              },
              required: ['id', 'duree'],
            },
          },
        },
        required: ['phase', 'postures'],
      },
    },
  },
  required: ['titre', 'phases'],
};

const SYSTEM = `Tu es un professeur de yoga expérimenté qui construit des séances cohérentes et sûres.
Règles impératives :
- Utilise UNIQUEMENT les identifiants (P001…) de la liste de postures fournie. N'invente jamais de posture.
- Respecte l'ordre et le temps de chaque phase donnée.
- Place une préparation avant les postures exigeantes et une contre-posture après les extensions, inversions et torsions fortes quand elles existent dans la liste.
- Pour une posture "deux côtés", compte le temps des deux côtés.
- Tiens compte des précautions et du thème ou des contraintes du groupe.
- Chaque posture n'apparaît qu'une seule fois dans la séance, SAUF si le thème ou les contraintes demandent de répéter une posture
  (ex. « Tadasana au début et à la fin », « 3 fois le chien tête en bas », « revenir à l'enfant entre les postures ») :
  répète-la alors exactement comme demandé, aux endroits demandés, en comptant le temps de chaque répétition.
- Rédige en français, vouvoiement.`;

function blocCible(cible, chaine, proches, bib) {
  if (!cible) return '';
  const contre = contrePosture(cible, bib);
  return `
POSTURE CIBLE : ${cible.id} — ${cible.fr}${cible.sanskrit ? ` (${cible.sanskrit})` : ''}, famille ${cible.famille}, niveau ${cible.niveau}.
Zones qu'elle sollicite : ${cible.zones?.length ? cible.zones.join(', ') : 'non renseignées'}.
Toute la séance est une progression qui amène les élèves à réaliser cette posture :
- Chaque phase active doit préparer au moins une de ces zones ; toutes doivent avoir été travaillées avant la cible.
- Montez en intensité phase après phase : d'abord mobiliser et échauffer, puis ouvrir / renforcer, puis des variantes de plus en plus proches de la cible.
${chaine.length ? `- Préparations à intégrer dans cet ordre, avant la cible (la dernière juste avant ou peu avant) : ${chaine.map((p) => `${p.id} ${p.fr}`).join(' → ')}.` : ''}
${proches.length ? `- Postures qui travaillent les mêmes zones, à répartir dans la progression : ${proches.slice(0, 12).map((p) => `${p.id} ${p.fr} [${(p.zones || []).filter((z) => cible.zones?.includes(z)).join(', ')}]`).join(' ; ')}.` : ''}
- La posture cible ${cible.id} est la DERNIÈRE posture de la phase « Pic ». Ajoutez dans "note" une consigne d'approche (étapes, variante facilitée possible).
${contre ? `- Juste après, ouvrez le retour au calme avec sa contre-posture ${contre.id} ${contre.fr}.` : '- Juste après, ouvrez le retour au calme par une contre-posture adaptée.'}
- N'utilisez la posture cible qu'une seule fois.`;
}

function blocEvites(evites) {
  if (!evites?.size) return '';
  return `
VARIÉTÉ : les postures marquées « DÉJÀ FAITE RÉCEMMENT » ont été proposées dans les séances précédentes du groupe.
Évitez-les au maximum et privilégiez d'autres postures de la liste. Ne les reprenez que si aucune alternative cohérente n'existe pour la phase
(les postures imposées par la posture cible, sa préparation et sa contre-posture restent autorisées).`;
}

async function composerAvecGemini({ style, styles, accessoires, duree, niveau, theme, phases, liste, cible, chaine, proches, relance, bib, evites }) {
  const prompt = `Séance demandée : ${styles.length ? (styles.length > 1 ? `mélange des styles ${style}` : style) : 'style libre, toutes disciplines confondues'}, ${duree} minutes, niveau ${niveau}.
${theme ? `Thème ou contraintes : ${theme}` : 'Pas de thème particulier.'}
${Array.isArray(accessoires) ? `\nACCESSOIRES DISPONIBLES : ${accessoires.length ? accessoires.join(', ') : 'aucun'}. La liste de postures est déjà limitée à celles faisables avec ce matériel ; n'ajoutez aucun autre accessoire dans les consignes.` : ''}
${blocCible(cible, chaine, proches, bib)}${blocEvites(evites)}
${relance ? `\nATTENTION : une première proposition ne préparait pas ces zones avant la posture cible : ${relance.join(', ')}. Ajoutez des postures qui les travaillent (voir "zones" dans la liste), avant la cible.` : ''}

Phases à respecter (dans cet ordre) :
${phases.map((p) => `- ${p.phase} : ${p.minutes} min`).join('\n')}

Postures disponibles (id | nom | famille | niveau | infos) :
${liste.map((p) => ligneCandidat(p) + (evites?.has(p.id) ? ' | DÉJÀ FAITE RÉCEMMENT' : '')).join('\n')}

Compose la séance. Donne un titre court et une intention en une phrase${cible ? ' qui annonce la posture cible' : ''}.`;
  return callGemini({ system: SYSTEM, prompt, schema: SCHEMA_SEANCE, delaiMs: Number(process.env.GEMINI_DELAI_SEANCE_MS) || 20000 });
}

// ---------- Générateur de secours (sans Gemini) ----------

function dureeEtTemps(p, restant) {
  if (p.minutes) return [p.minutes, `${p.minutes} min`];
  if (p.respirations) return [(p.respirations * 6 * (p.cotes ? 2 : 1) + 30) / 60, `${p.respirations} respirations`];
  if (p.famille === 'Enchaînement') return [4, '× 3 tours'];
  const t = Math.max(2, restant);
  return [t, `${Math.round(t)} min`];
}

function composerSansIA({ style, phases, liste, cible, chaine, bib, evites }) {
  const reserves = new Set(cible ? [cible.id, ...chaine.map((p) => p.id), contrePosture(cible, bib)?.id].filter(Boolean) : []);
  const utilises = new Set();
  const iPic = phases.findIndex((p) => p.phase === 'Pic');
  return {
    titre: cible ? `${style} — vers ${nomAffiche(cible)}` : `${style} — séance type`,
    intention: cible
      ? `Progression vers ${nomAffiche(cible)}, composée sans IA (mode hors-ligne).`
      : 'Séance composée sans IA (mode hors-ligne) à partir de votre bibliothèque.',
    phases: phases.map(({ phase, minutes }, i) => {
      const choix = [];
      let temps = 0;
      // Préparations de la cible : dans la phase qui précède le pic, puis cible en fin de pic
      const imposees = [];
      if (cible && i === iPic - 1) imposees.push(...chaine.filter((p) => p.phase !== 'Pic'));
      if (cible && i === iPic) imposees.push(...chaine.filter((p) => p.phase === 'Pic'));
      for (const p of imposees) {
        const [t, duree] = dureeEtTemps(p, minutes - temps);
        choix.push({ id: p.id, duree });
        utilises.add(p.id);
        temps += t;
      }
      const tempsCible = cible && i === iPic ? dureeEtTemps(cible, 2)[0] : 0;
      // Avec une cible, avant le pic : priorité aux postures qui travaillent ses zones
      const avantPic = cible && i < iPic;
      const pool = [...liste]
        .filter((p) => p.phase === phase && !utilises.has(p.id) && !reserves.has(p.id))
        .map((p) => ({ p, s: Math.random() + (avantPic ? recouvrement(p, cible) : 0) - (evites?.has(p.id) ? 5 : 0) }))
        .sort((a, b) => b.s - a.s)
        .map((x) => x.p);
      const vus = new Set();
      for (const p of pool) {
        if (temps + tempsCible >= minutes) break;
        if (['Relaxation', 'Respiration'].includes(p.famille) && vus.has(p.famille)) continue;
        vus.add(p.famille);
        const [t, duree] = dureeEtTemps(p, minutes - temps);
        choix.push({ id: p.id, duree });
        utilises.add(p.id);
        temps += t;
      }
      return { phase, postures: choix };
    }),
  };
}

// ---------- Étape 3 : vérification (code) ----------

function verifier(brut, phases, liste, cible, bib) {
  const autorises = new Set(liste.map((p) => p.id));
  let rejetes = 0;
  const parPhase = new Map((brut.phases || []).map((p) => [p.phase, p.postures || []]));
  const resultat = phases.map(({ phase, minutes }) => {
    const items = (parPhase.get(phase) || [])
      .filter((it) => {
        const ok = autorises.has(it.id);
        if (!ok) rejetes++;
        return ok;
      })
      .map((it) => ({ ...it, posture: bib.BY_ID.get(it.id) }));
    return { phase, minutes, items };
  });
  const total = resultat.reduce((s, p) => s + p.items.length, 0);
  return { phases: cible ? placerCible(resultat, cible, bib) : resultat, rejetes, total };
}

// Garantit que la cible est la dernière posture du pic (une seule fois) et qu'elle est suivie de sa contre-posture.
function placerCible(phases, cible, bib) {
  let noteCible = null;
  let dureeCible = null;
  const sansCible = phases.map((ph) => ({
    ...ph,
    items: ph.items.filter((it) => {
      if (it.id !== cible.id) return true;
      noteCible = noteCible || it.note || null;
      dureeCible = dureeCible || it.duree;
      return false;
    }),
  }));
  const iPic = sansCible.findIndex((ph) => ph.phase === 'Pic');
  const pic = sansCible[iPic];
  pic.items.push({
    id: cible.id,
    duree: dureeCible || dureeEtTemps(cible, 2)[1],
    note: noteCible || 'Posture cible : prenez le temps de l’approche, variante facilitée possible.',
    posture: cible,
  });

  const contre = contrePosture(cible, bib);
  const suivante = sansCible[iPic + 1];
  if (contre && suivante && !suivante.items.some((it) => it.id === contre.id)) {
    // Retire la contre-posture si elle est ailleurs, puis la place en tête de la phase suivante
    sansCible.forEach((ph) => { ph.items = ph.items.filter((it) => it.id !== contre.id); });
    suivante.items.unshift({ id: contre.id, duree: dureeEtTemps(contre, 2)[1], note: `Contre-posture de ${nomAffiche(cible)}`, posture: contre });
  }

  // Rôles pour l'affichage
  const prep = new Set(chainePreparation(cible, bib).map((p) => p.id));
  return sansCible.map((ph) => ({
    ...ph,
    items: ph.items.map((it) => ({
      ...it,
      role: it.id === cible.id ? 'cible' : contre && it.id === contre.id ? 'contre' : prep.has(it.id) ? 'preparation' : undefined,
    })),
  }));
}

// Zones de la cible travaillées par les postures placées avant elle
function bilanZones(phases, cible) {
  if (!cible || !cible.zones?.length) return null;
  const travaillees = new Set();
  let trouvee = false;
  for (const ph of phases) {
    for (const it of ph.items) {
      if (it.id === cible.id) { trouvee = true; break; }
      (it.posture.zones || []).forEach((z) => travaillees.add(z));
    }
    if (trouvee) break;
  }
  return {
    couvertes: cible.zones.filter((z) => travaillees.has(z)),
    manquantes: cible.zones.filter((z) => !travaillees.has(z)),
  };
}

export async function genererSeance({ styles = [], accessoires = null, duree, niveau, theme, cibleId, evites: idsEvites = [] }) {
  const style = libelleStyles(styles);
  const bib = indexer(await chargerPostures());
  // Postures des séances précédentes à éviter (identifiants inconnus ignorés)
  const evites = new Set(idsEvites.filter((id) => bib.BY_ID.has(id)));
  const cible = cibleId ? bib.BY_ID.get(cibleId) : null;
  if (cibleId && !cible) throw new Error(`Posture cible inconnue : ${cibleId}`);

  const phases = planPhases(styles, Number(duree), Boolean(cible));
  let liste = candidats(styles, niveau, bib, accessoires);
  let chaine = [];
  let proches = [];
  if (cible) {
    // La cible, sa chaîne de préparation et sa contre-posture sont toujours disponibles,
    // même hors du style ou au-dessus du niveau choisi.
    chaine = chainePreparation(cible, bib);
    const contre = contrePosture(cible, bib);
    const ajouts = [cible, ...chaine, contre].filter(Boolean);
    const ids = new Set(liste.map((p) => p.id));
    liste = [...liste, ...ajouts.filter((p) => !ids.has(p.id))];
    proches = posturesProches(cible, liste, new Set(chaine.map((p) => p.id)));
  }
  if (liste.length === 0) throw new Error('Aucune posture compatible dans la bibliothèque.');

  const ia = hasGeminiKey();
  let brut;
  let verifie;
  let modele = null;
  let bilan = null;
  if (ia) {
    // 1re tentative
    const r = await composerAvecGemini({ style, styles, accessoires, duree, niveau, theme, phases, liste, cible, chaine, proches, bib, evites });
    brut = r.donnees;
    modele = r.modele;
    verifie = verifier(brut, phases, liste, cible, bib);
    bilan = bilanZones(verifie.phases, cible);

    // 2e tentative si la réponse est mauvaise, ou si des zones de la cible ne sont pas préparées.
    // On garde la meilleure des deux ; un échec de la relance n'annule pas la 1re séance.
    const mauvaise = verifie.total === 0 || verifie.rejetes > verifie.total * 0.3;
    const incomplete = bilan && bilan.manquantes.length > 0;
    if (mauvaise || incomplete) {
      try {
        const r2 = await composerAvecGemini({
          style, styles, accessoires, duree, niveau, theme, phases, liste, cible, chaine, proches, bib, evites,
          relance: incomplete ? bilan.manquantes : null,
        });
        const v2 = verifier(r2.donnees, phases, liste, cible, bib);
        const b2 = bilanZones(v2.phases, cible);
        const meilleure = v2.total > 0 && v2.rejetes <= v2.total * 0.3
          && (mauvaise || (b2?.manquantes.length ?? 0) < bilan.manquantes.length);
        if (meilleure) { brut = r2.donnees; modele = r2.modele; verifie = v2; bilan = b2; }
      } catch (e) {
        console.warn(`[seance] relance échouée : ${e.message}`);
      }
    }
  } else {
    brut = composerSansIA({ style, phases, liste, cible, chaine, bib, evites });
    verifie = verifier(brut, phases, liste, cible, bib);
    bilan = bilanZones(verifie.phases, cible);
  }

  const max = structures.niveaux[niveau]?.max ?? 1;
  return {
    preparationZones: bilan,
    style, styles, accessoires: Array.isArray(accessoires) ? accessoires : null, duree: Number(duree), niveau, theme: theme || null,
    cibleId: cible ? cible.id : null,
    avertissement: cible && accessoiresManquants(cible, accessoires).length
      ? `${nomAffiche(cible)} demande : ${accessoiresManquants(cible, accessoires).join(', ').toLowerCase()} (non coché dans vos accessoires). Prévoyez une variante sans, ou ajoutez-le.`
      : cible && cible.niveau > max
      ? `${nomAffiche(cible)} est de niveau ${cible.niveau}, au-dessus du niveau ${niveau} choisi : proposez une variante facilitée.`
      : cible && !convientAuxStyles(cible, styles)
        ? `${nomAffiche(cible)} n'est cochée pour aucun des styles choisis (${style}) dans votre bibliothèque.`
        : null,
    titre: brut.titre, intention: brut.intention || null,
    mode: ia ? 'gemini' : 'hors-ligne',
    modele,
    phases: verifie.phases,
    postures_rejetees: verifie.rejetes,
  };
}
