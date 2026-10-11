// Stockage local (navigateur) — v1 sans base de données.
// Toutes les lectures/écritures sont protégées : l'appli fonctionne même si le stockage est indisponible.

const PREFIXE_FICHE = 'yoga:fiche:';

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

// Séances enregistrées
export const listerSeances = () => lire('yoga:seances', []);
export function enregistrerSeance(seance) {
  const liste = listerSeances().filter((s) => s.uid !== seance.uid);
  liste.unshift({ ...seance, enregistreeLe: new Date().toISOString() });
  return ecrire('yoga:seances', liste.slice(0, 100));
}
export function supprimerSeance(uid) {
  return ecrire('yoga:seances', listerSeances().filter((s) => s.uid !== uid));
}

// Fiches « Comment faire ? » (cache + validation)
export const lireFiche = (id) => lire(`${PREFIXE_FICHE}${id}`, null);
export const ecrireFiche = (id, donnees) => ecrire(`${PREFIXE_FICHE}${id}`, donnees);
export const supprimerFiche = (id) => effacer(`${PREFIXE_FICHE}${id}`);

// Toutes les fiches validées de cet appareil : { [id]: fiche }
export function fichesValidees() {
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

// Import d'un fichier exporté : écrase les fiches locales de mêmes identifiants
export function importerFiches(fiches) {
  let n = 0;
  for (const [id, fiche] of Object.entries(fiches || {})) {
    if (fiche && Array.isArray(fiche.entree)) {
      if (ecrireFiche(id, { fiche: { ...fiche, mode: 'gemini' }, validee: true })) n++;
    }
  }
  return n;
}
