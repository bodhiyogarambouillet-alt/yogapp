// Brouillon de la séance en cours, gardé sur l'appareil : si l'appli est fermée sans le vouloir (ou par Android),
// on retrouve la séance (même non enregistrée, avec ses modifications) et l'avancement dans la séance en direct.
const CLE = 'yoga:brouillon';
const CLE_PROGRESSION = 'yoga:progression';
const DUREE_BROUILLON = 7 * 24 * 3600 * 1000; // au-delà d'une semaine, il est oublié
const DUREE_PROGRESSION = 12 * 3600 * 1000; // une séance interrompue se reprend dans la journée

const lire = (cle, duree) => {
  try {
    const v = JSON.parse(localStorage.getItem(cle));
    return v && Date.now() - v.le < duree ? v : null;
  } catch {
    return null;
  }
};
const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify({ ...v, le: Date.now() })); } catch { /* stockage plein ou indisponible */ } };
const effacer = (cle) => { try { localStorage.removeItem(cle); } catch { /* stockage indisponible */ } };

// { seance, enregistree, params }
export const lireBrouillon = () => lire(CLE, DUREE_BROUILLON);
export const ecrireBrouillon = (b) => ecrire(CLE, b);
export const oublierBrouillon = () => { effacer(CLE); effacer(CLE_PROGRESSION); };

// Avancement dans la séance en direct : { uid, index, restant (s) }
export const lireProgression = (uid) => {
  const p = lire(CLE_PROGRESSION, DUREE_PROGRESSION);
  return p && p.uid === uid ? p : null;
};
export const ecrireProgression = (p) => ecrire(CLE_PROGRESSION, p);
export const oublierProgression = () => effacer(CLE_PROGRESSION);
