// Stockage des séances et des fiches.
// - Supabase configuré : séances dans la table `seances` (par compte), fiches dans la table
//   `fiches` (partagées ; seuls les admins valident ou modifient).
// - Sinon (ou séances sans connexion) : stockage dans le navigateur, comme en v1.
// Toutes les fonctions sont asynchrones pour que les écrans n'aient pas à savoir lequel est utilisé.

import { supabase, enteteAuth } from './supabase.js';
import FICHES_REFERENCE from './data/fiches.json';

const PREFIXE_FICHE = 'yoga:fiche:';
const CLE_SEANCES = 'yoga:seances';

// ---------- Navigateur (localStorage protégé) ----------

function lire(cle, defaut) {
  try {
    const v = localStorage.getItem(cle);
    return v ? JSON.parse(v) : defaut;
  } catch {
    return defaut;
  }
}
function ecrire(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
}
function effacer(cle) {
  try {
    localStorage.removeItem(cle);
  } catch {
    /* stockage indisponible */
  }
}

async function sessionActive() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

// ---------- Séances ----------

// La séance est stockée sans les objets posture (recollés à l'ouverture depuis la bibliothèque)
const alleger = (seance) => ({
  ...seance,
  phases: seance.phases.map((ph) => ({ ...ph, items: ph.items.map(({ posture: _p, ...it }) => it) })),
});

export async function listerSeances() {
  if (await sessionActive()) {
    const { data, error } = await supabase.from('seances').select('id, contenu, maj_le').order('maj_le', { ascending: false }).limit(200);
    if (error) throw error;
    return data.map((l) => ({ ...l.contenu, uid: l.id, enregistreeLe: l.maj_le }));
  }
  return lire(CLE_SEANCES, []);
}

export async function enregistrerSeance(seance) {
  const legere = alleger(seance);
  if (await sessionActive()) {
    const { error } = await supabase.from('seances').upsert({
      id: legere.uid, style: legere.style, duree: legere.duree, niveau: legere.niveau,
      cible_id: legere.cibleId || null, titre: legere.titre || null, contenu: legere,
    });
    if (error) throw error;
    return true;
  }
  const liste = lire(CLE_SEANCES, []).filter((s) => s.uid !== legere.uid);
  liste.unshift({ ...legere, enregistreeLe: new Date().toISOString() });
  return ecrire(CLE_SEANCES, liste.slice(0, 100));
}

export async function supprimerSeance(uid) {
  if (await sessionActive()) {
    const { error } = await supabase.from('seances').delete().eq('id', uid);
    if (error) throw error;
    return true;
  }
  return ecrire(CLE_SEANCES, lire(CLE_SEANCES, []).filter((s) => s.uid !== uid));
}

// ---------- Fiches « Comment faire ? » ----------
// Forme renvoyée aux écrans : { fiche, validee, source: 'base' | 'locale' | 'reference' }

const CHAMPS = ['entree', 'alignement', 'respiration', 'sortie', 'variante_facilitee', 'variante_avancee'];
const contenuDe = (fiche) => Object.fromEntries(CHAMPS.map((k) => [k, fiche[k] ?? (k === 'entree' || k === 'alignement' ? [] : '')]));

async function appelApi(corps) {
  const r = await fetch('/api/fiche-posture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await enteteAuth()) },
    body: JSON.stringify(corps),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.erreur || 'Erreur de génération');
  return data;
}

// Ouvre une fiche : base Supabase (ou génération côté serveur) ; en mode local : navigateur > référence > génération
export async function obtenirFiche(id, contexte) {
  if (supabase) {
    const data = await appelApi({ id, style: contexte?.style, niveau: contexte?.niveau });
    return { fiche: data, validee: data.statut === 'validee', source: 'base' };
  }
  const locale = lire(`${PREFIXE_FICHE}${id}`, null);
  if (locale) return { ...locale, source: 'locale' };
  if (FICHES_REFERENCE[id]) return { fiche: FICHES_REFERENCE[id], validee: true, source: 'reference' };
  const data = await appelApi({ id, style: contexte?.style, niveau: contexte?.niveau });
  if (data.mode === 'gemini') ecrire(`${PREFIXE_FICHE}${id}`, { fiche: data, validee: false });
  return { fiche: data, validee: false, source: 'locale' };
}

export async function regenererFiche(id, contexte) {
  if (!supabase) effacer(`${PREFIXE_FICHE}${id}`);
  const data = await appelApi({ id, style: contexte?.style, niveau: contexte?.niveau, regenerer: true });
  if (!supabase && data.mode === 'gemini') ecrire(`${PREFIXE_FICHE}${id}`, { fiche: data, validee: false });
  return { fiche: data, validee: false, source: supabase ? 'base' : 'locale' };
}

// Valider / retirer la validation ; avec `fiche`, enregistre aussi un texte modifié
export async function enregistrerFiche(id, fiche, validee) {
  const session = await sessionActive();
  if (supabase) {
    if (!session) throw new Error('Connectez-vous pour valider ou modifier une fiche.');
    const { data, error } = await supabase.from('fiches').upsert({
      posture_id: id, contenu: contenuDe(fiche), statut: validee ? 'validee' : 'generee',
      valide_par: validee ? session.user.email : null, modele: fiche.modele || null,
    }).select('posture_id');
    if (error) throw error;
    if (!data?.length) throw new Error('Modification refusée : ce compte n’est pas administrateur.');
    return { fiche, validee, source: 'base' };
  }
  ecrire(`${PREFIXE_FICHE}${id}`, { fiche, validee });
  return { fiche, validee, source: 'locale' };
}

export async function revenirReference(id) {
  effacer(`${PREFIXE_FICHE}${id}`);
  return { fiche: FICHES_REFERENCE[id], validee: true, source: 'reference' };
}
export const aUneReference = (id) => !supabase && Boolean(FICHES_REFERENCE[id]);

// Fiches validées : { [id]: contenu } — base si Supabase, sinon navigateur
export async function fichesValidees() {
  if (supabase) {
    const { data, error } = await supabase.from('fiches').select('posture_id, contenu').eq('statut', 'validee');
    if (error) throw error;
    return Object.fromEntries(data.map((l) => [l.posture_id, l.contenu]));
  }
  return fichesValideesLocales();
}

function fichesValideesLocales() {
  const resultat = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (!cle?.startsWith(PREFIXE_FICHE)) continue;
      const v = lire(cle, null);
      if (v?.validee && v.fiche) resultat[cle.slice(PREFIXE_FICHE.length)] = v.fiche;
    }
  } catch {
    /* stockage indisponible */
  }
  return resultat;
}

// Import d'un fichier exporté (ou transfert depuis le navigateur) : fiches marquées validées
export async function importerFiches(fiches) {
  const valides = Object.entries(fiches || {}).filter(([, f]) => f && Array.isArray(f.entree) && f.entree.length);
  if (supabase) {
    const session = await sessionActive();
    if (!session) throw new Error('Connectez-vous pour importer des fiches.');
    if (!valides.length) return 0;
    const { data, error } = await supabase.from('fiches').upsert(valides.map(([id, f]) => ({
      posture_id: id, contenu: contenuDe(f), statut: 'validee', valide_par: session.user.email,
    }))).select('posture_id');
    if (error) throw error;
    if (!data?.length) throw new Error('Import refusé : ce compte n’est pas administrateur.');
    return data.length;
  }
  let n = 0;
  for (const [id, f] of valides) if (ecrire(`${PREFIXE_FICHE}${id}`, { fiche: { ...f, mode: 'gemini' }, validee: true })) n++;
  return n;
}

// ---------- Transfert des données du navigateur vers Supabase (une fois) ----------

export function donneesLocales() {
  return { seances: lire(CLE_SEANCES, []), fiches: fichesValideesLocales() };
}

export async function transfererDonneesLocales({ admin }) {
  const { seances, fiches } = donneesLocales();
  let nSeances = 0;
  for (const s of seances) {
    await enregistrerSeance({ ...s, phases: s.phases.map((ph) => ({ ...ph, items: ph.items })) });
    nSeances++;
  }
  const nFiches = admin && Object.keys(fiches).length ? await importerFiches(fiches) : 0;
  // Nettoyage du navigateur une fois transféré
  if (nSeances) effacer(CLE_SEANCES);
  if (nFiches) Object.keys(fiches).forEach((id) => effacer(`${PREFIXE_FICHE}${id}`));
  return { nSeances, nFiches };
}
