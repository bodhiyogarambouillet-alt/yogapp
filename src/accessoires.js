// Accessoires : la bibliothèque les note en texte libre (« Briques, chaise », « Mur ou chaise »…).
// On les ramène à une liste fixe pour pouvoir choisir ceux dont on dispose.
// Partagé entre le navigateur et les fonctions serveur.

export const ACCESSOIRES = ['Coussin', 'Couverture', 'Bolster', 'Brique', 'Sangle', 'Chaise', 'Mur', 'Ballon', 'Espalier'];

const MOTS = [
  [/coussin/, 'Coussin'], [/couverture/, 'Couverture'], [/bolster/, 'Bolster'], [/brique/, 'Brique'],
  [/sangle/, 'Sangle'], [/chaise/, 'Chaise'], [/mur/, 'Mur'], [/ballon/, 'Ballon'], [/espalier|barre/, 'Espalier'],
];
const reconnu = (texte) => MOTS.find(([re]) => re.test(texte.toLowerCase()))?.[1] || null;

// « Briques, chaise » → [['Brique'], ['Chaise']] ; « Mur ou chaise » → [['Mur', 'Chaise']]
// Une virgule = les deux sont utiles ; « ou » = l'un ou l'autre suffit.
export function besoinsAccessoires(posture) {
  return (posture.accessoires || '')
    .split(',')
    .map((groupe) => groupe.split(/\bou\b/).map(reconnu).filter(Boolean))
    .filter((alternatives) => alternatives.length > 0);
}

// dispo : null = tous les accessoires (aucun filtre), sinon la liste de ceux dont on dispose
export const faisableAvec = (posture, dispo) =>
  !Array.isArray(dispo) || besoinsAccessoires(posture).every((alts) => alts.some((a) => dispo.includes(a)));

export const accessoiresManquants = (posture, dispo) =>
  !Array.isArray(dispo) ? [] : besoinsAccessoires(posture).filter((alts) => !alts.some((a) => dispo.includes(a))).map((alts) => alts.join(' ou '));
