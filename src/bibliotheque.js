import posturesLocales from './data/postures.json';
import structures from './data/structures.json';
import { stylesDe, convientAuxStyles } from './styles-seance.js';
import { faisableAvec } from './accessoires.js';
import { supabase } from './supabase.js';

// Bibliothèque en mémoire. Au démarrage : copie locale (JSON), puis remplacée par
// la version Supabase si elle est configurée et joignable (mise à jour sur place).
export const POSTURES = [...posturesLocales];
export const PAR_ID = new Map(POSTURES.map((p) => [p.id, p]));
const postures = POSTURES;

export async function chargerBibliotheque() {
  if (!supabase) return 'locale';
  const { data, error } = await supabase.from('postures').select('*').order('id');
  if (error || !data?.length) {
    if (error) console.warn('[bibliothèque] Supabase indisponible, copie locale utilisée :', error.message);
    return 'locale';
  }
  const lignes = data.map((p) => ({ ...p, minutes: p.minutes === null ? null : Number(p.minutes) }));
  POSTURES.splice(0, POSTURES.length, ...lignes);
  PAR_ID.clear();
  lignes.forEach((p) => PAR_ID.set(p.id, p));
  return 'supabase';
}
// Nom affiché : sanskrit d'abord, nom français en second (repli sur le français sans sanskrit)
export const nom = (p) => p.sanskrit || p.fr;
export const nomSecondaire = (p) => (p.sanskrit ? p.fr : null);

export const STYLES = Object.keys(structures.styles);
export const NIVEAUX = [
  { nom: 'Débutant', aide: 'Postures de niveau 1' },
  { nom: 'Intermédiaire', aide: 'Niveaux 1 et 2, pic de niveau 2' },
  { nom: 'Avancé', aide: 'Tous niveaux, pic exigeant' },
];
export const DUREES = [30, 45, 60, 75, 90];

// Teintes des phases (barre de répartition et pastilles)
export const TEINTES = ['#B9AECB', '#A597BC', '#9180AE', '#7D6A9F', '#6A5690', '#5B4A7A', '#8E83A3', '#C9C1D6'];

// Variantes d'une posture (à proposer à sa place ou en complément) : même famille, ou même phase avec des zones
// communes ; tous niveaux, adaptées au style et aux accessoires, pas déjà dans la séance. Les plus proches d'abord.
export function variantes(posture, seance) {
  const dejaLa = new Set(seance.phases.flatMap((ph) => ph.items.map((it) => it.id)));
  const stylesSeance = stylesDe(seance);
  const zones = new Set(posture.zones || []);
  const communes = (p) => (p.zones || []).filter((z) => zones.has(z)).length;
  return postures
    .filter((p) => !dejaLa.has(p.id) && convientAuxStyles(p, stylesSeance) && faisableAvec(p, seance.accessoires)
      && (p.famille === posture.famille || (p.phase === posture.phase && communes(p) > 0)))
    .map((p) => ({ p, s: communes(p) * 2 + (p.famille === posture.famille ? 2 : 0) - Math.abs(p.niveau - posture.niveau) }))
    .sort((a, b) => b.s - a.s || a.p.niveau - b.p.niveau)
    .slice(0, 12)
    .map((x) => x.p);
}

// Postures proposées en variante d'une ligne de séance
export const variantesDe = (item) => (item.variantes || []).map((id) => PAR_ID.get(id)).filter(Boolean);

// Recherche d'une posture par nom français, sanskrit ou anglais (sans tenir compte des accents)
const sansAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// toutes : inclut respirations et relaxations (exclues pour le choix d'une posture cible)
export function rechercherPostures(texte, styles, limite = 8, toutes = false) {
  const q = sansAccents(texte.trim());
  if (q.length < 2) return [];
  const trouvees = postures.filter((p) =>
    (toutes || (p.famille !== 'Respiration' && p.famille !== 'Relaxation')) &&
    [p.fr, p.sanskrit, p.en].some((n) => sansAccents(n).includes(q)));
  // Celles du style choisi d'abord, puis par niveau
  trouvees.sort((a, b) => (convientAuxStyles(b, styles) - convientAuxStyles(a, styles)) || a.niveau - b.niveau);
  return trouvees.slice(0, limite);
}

export const NIVEAU_MAX = { 'Débutant': 1, 'Intermédiaire': 2, 'Avancé': 3 };

// Bilan recalculé à chaque modification : zones de la cible travaillées avant elle
export function bilanZones(seance) {
  const cible = seance.cibleId ? PAR_ID.get(seance.cibleId) : null;
  if (!cible || !cible.zones?.length) return null;
  const travaillees = new Set();
  let trouvee = false;
  for (const ph of seance.phases) {
    for (const it of ph.items) {
      if (it.id === cible.id) { trouvee = true; break; }
      (it.posture?.zones || []).forEach((z) => travaillees.add(z));
    }
    if (trouvee) break;
  }
  return {
    couvertes: cible.zones.filter((z) => travaillees.has(z)),
    manquantes: cible.zones.filter((z) => !travaillees.has(z)),
  };
}

export function dureeParDefaut(p) {
  if (p.minutes) return `${p.minutes} min`;
  if (p.respirations) return `${p.respirations} respirations`;
  return '';
}

export function infos(item) {
  const p = item.posture;
  return [nomSecondaire(p), item.duree, p.cotes ? 'droite + gauche' : null, p.accessoires ? p.accessoires.toLowerCase() : null]
    .filter(Boolean)
    .join(' · ');
}

export function accessoiresSeance(seance) {
  const set = new Set();
  seance.phases.forEach((ph) => ph.items.forEach((it) => {
    (it.posture.accessoires || '').split(/,|\bou\b/).map((s) => s.trim()).filter(Boolean)
      .forEach((a) => set.add(a.charAt(0).toUpperCase() + a.slice(1).toLowerCase()));
  }));
  return [...set];
}
