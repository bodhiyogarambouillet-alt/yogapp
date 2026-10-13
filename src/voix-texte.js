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

// Durée lue à voix haute : « 5 respirations », « 3 min » → « 3 minutes », « × 3 tours » → « 3 fois »
export const dureeLue = (d) => (d || '').replace(/\bmin\b/g, 'minutes').replace(/\bresp\.?\b/g, 'respirations').replace(/×\s*(\d+)/, '$1 fois');

export const segmentDuree = (duree, cotes) => (duree ? phrase(`${dureeLue(duree)}${cotes ? ' de chaque côté' : ''}`) : '');

// Consignes d'une fiche : résumé (ou premiers repères) puis souffle en bref, en un seul segment
export function segmentConsignes(fiche) {
  const consignes = fiche?.resume?.length ? fiche.resume : (fiche?.alignement || []).slice(0, 3);
  return [...consignes, fiche?.souffle_court].filter(Boolean).map(phrase).join(' ');
}

// Annonce d'une posture : phase (si elle change), rôle, nom, durée, la phrase écrite sous la posture,
// le côté, puis les consignes de la fiche (niveau « consignes »)
export function segmentsAnnonce({ etape, fiche, nouvellePhase, niveau }) {
  const p = etape.posture;
  return [
    nouvellePhase ? phrase(etape.phase) : '',
    ROLES_VOIX[etape.role] || '',
    segmentNom(p),
    segmentDuree(etape.duree, p.cotes),
    phrase(etape.note),
    p.cotes ? PHRASES_FIXES.cote : '',
    niveau === 'consignes' ? segmentConsignes(fiche) : '',
  ].filter(Boolean);
}
