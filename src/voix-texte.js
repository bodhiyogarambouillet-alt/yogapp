// Textes de la voix guide, découpés en segments réutilisables : la plupart (nom d'une posture, ses consignes,
// les phases, les durées) sont identiques d'une séance à l'autre et peuvent être générés une fois pour toutes
// (scripts/pregenerer-voix.mjs). Fichier partagé par l'appli et les scripts : aucune dépendance au navigateur.

// Réglages de la voix naturelle, partagés par le serveur (lib/voix.js) et l'appli : le nom de chaque fichier audio
// est une empreinte de ces réglages et du texte, que l'appli sait recalculer seule (lecture hors connexion).
export const MODELE_VOIX = 'gemini-3.1-flash-tts-preview';
export const VOIX_DEFAUT = 'Aoede';
export const TON_VOIX = "Lis ce texte en français, d'une voix calme, douce et posée de professeure de yoga, avec de courtes pauses entre les phrases. Prononce les noms sanskrits des postures correctement, à l'indienne :";

export const ROLES_VOIX = { preparation: 'Préparation.', cible: 'Posture cible.', contre: 'Contre-posture.' };
export const PHRASES_FIXES = { cote: 'Côté droit.', changer: 'Changez de côté. Côté gauche.', fin: 'Séance terminée. Namasté.' };

export const phrase = (t) => {
  const s = (t || '').replace(/\s+/g, ' ').trim();
  return !s || /[.!?…]$/.test(s) ? s : `${s}.`;
};

// Nom lu à voix haute : sanskrit puis français (« Virabhadrasana deux, Guerrier deux. »),
// chiffres romains en toutes lettres, « / » remplacé par une virgule
const ROMAINS = { I: 'un', II: 'deux', III: 'trois', IV: 'quatre' };
const lisible = (t) => (t || '').replace(/\s*\/\s*/g, ', ').replace(/\b(IV|III|II|I)\b/g, (r) => ROMAINS[r]);
export const segmentNom = (p) => phrase(p.sanskrit ? `${lisible(p.sanskrit)}, ${lisible(p.fr)}` : lisible(p.fr));

// Durée lue à voix haute : « 10 resp. » → « 10 respirations », « 3 min » → « 3 minutes », « 1 min » → « 1 minute »,
// « 30 sec » → « 30 secondes », « × 3 tours » → « 3 tours », « × 3 » → « 3 fois »
export const dureeLue = (d) => (d || '')
  .replace(/\bmin\b\.?/g, 'minutes').replace(/\bresp\b\.?/g, 'respirations').replace(/\b(sec|s)\b\.?/g, 'secondes')
  .replace(/×\s*(\d+)\s*(?=\p{L})/u, '$1 ').replace(/×\s*(\d+)/, '$1 fois')
  .replace(/\b1 (minute|respiration|tour|seconde)s\b/g, '1 $1')
  .replace(/\s+/g, ' ').trim();

// Durées courantes, générées à l'avance (scripts/pregenerer-voix*.mjs) pour ne pas solliciter Gemini en séance
export const DUREES_COURANTES = [
  ...Array.from({ length: 15 }, (_, i) => `${i + 1} min`),
  ...Array.from({ length: 15 }, (_, i) => `${i + 1} resp.`),
  ...Array.from({ length: 6 }, (_, i) => `× ${i + 1} tours`),
];

// Une durée sans chiffre (« variable », « libre »…) n'apprend rien : elle n'est pas lue
export const segmentDuree = (duree, cotes) => (/\d/.test(duree || '') ? phrase(`${dureeLue(duree)}${cotes ? ' de chaque côté' : ''}`) : '');

// Annonce d'une posture : phase (si elle change), rôle, nom, durée et côté.
// La phrase écrite sous la posture et les consignes de la fiche ne sont pas lues.
export function segmentsAnnonce({ etape, nouvellePhase }) {
  const p = etape.posture;
  return [
    nouvellePhase ? phrase(etape.phase) : '',
    ROLES_VOIX[etape.role] || '',
    segmentNom(p),
    segmentDuree(etape.duree, p.cotes),
    p.cotes ? PHRASES_FIXES.cote : '',
  ].filter(Boolean);
}
