import posturesLocales from './data/postures.json';
import structures from './data/structures.json';
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
export const STYLES = Object.keys(structures.styles);
export const NIVEAUX = [
  { nom: 'Débutant', aide: 'Postures de niveau 1' },
  { nom: 'Intermédiaire', aide: 'Niveaux 1 et 2, pic de niveau 2' },
  { nom: 'Avancé', aide: 'Tous niveaux, pic exigeant' },
];
export const DUREES = [30, 45, 60, 75, 90];

// Teintes des phases (barre de répartition et pastilles)
export const TEINTES = ['#B9AECB', '#A597BC', '#9180AE', '#7D6A9F', '#6A5690', '#5B4A7A', '#8E83A3', '#C9C1D6'];

// Alternatives pour « remplacer » : même style, niveau autorisé, même famille ou même phase,
// pas déjà présentes dans la séance.
export function alternatives(posture, seance) {
  const max = structures.niveaux[seance.niveau]?.max ?? 1;
  const dejaLa = new Set(seance.phases.flatMap((ph) => ph.items.map((it) => it.id)));
  const ok = (p) => p.styles.includes(seance.style) && p.niveau <= max && !dejaLa.has(p.id);
  // Score : zones communes (pour garder l'effet de la posture remplacée), puis même famille, puis même phase
  const zones = new Set(posture.zones || []);
  return postures
    .filter((p) => ok(p) && (p.famille === posture.famille || p.phase === posture.phase))
    .map((p) => ({ p, s: (p.zones || []).filter((z) => zones.has(z)).length * 2 + (p.famille === posture.famille ? 1 : 0) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

// Recherche d'une posture par nom français, sanskrit ou anglais (sans tenir compte des accents)
const sansAccents = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function rechercherPostures(texte, style, limite = 8) {
  const q = sansAccents(texte.trim());
  if (q.length < 2) return [];
  const trouvees = postures.filter((p) =>
    p.famille !== 'Respiration' && p.famille !== 'Relaxation' &&
    [p.fr, p.sanskrit, p.en].some((n) => sansAccents(n).includes(q)));
  // Celles du style choisi d'abord, puis par niveau
  trouvees.sort((a, b) => (b.styles.includes(style) - a.styles.includes(style)) || a.niveau - b.niveau);
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
  return [p.sanskrit, item.duree, p.cotes ? 'droite + gauche' : null, p.accessoires ? p.accessoires.toLowerCase() : null]
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
