// Textes de la voix guide, découpés en segments réutilisables : la plupart (nom d'une posture, ses consignes,
// les phases, les durées) sont identiques d'une séance à l'autre et peuvent être générés une fois pour toutes
// (scripts/pregenerer-voix.mjs). Fichier partagé par l'appli et les scripts : aucune dépendance au navigateur.

// Réglages de la voix naturelle, partagés par le serveur (lib/voix.js) et l'appli : le nom de chaque fichier audio
// est une empreinte de ces réglages et du texte, que l'appli sait recalculer seule (lecture hors connexion).
export const MODELE_VOIX = 'gemini-3.1-flash-tts-preview';
export const VOIX_DEFAUT = 'Aoede';
export const TON_VOIX = "Lis ce texte en français, d'une voix calme, douce et posée de professeure de yoga, avec de courtes pauses entre les phrases. Prononce les noms sanskrits des postures correctement, à l'indienne :";

export const ROLES_VOIX = { preparation: 'Préparation.', cible: 'Posture cible.', contre: 'Contre-posture.' };
// Savasana accompagné : détente guidée pendant la relaxation finale (balayage du corps, puis retour)
export const SAVASANA = {
  detente: [
    "Installez-vous confortablement sur le dos. Laissez les bras s'éloigner un peu du corps, paumes tournées vers le ciel. Fermez doucement les yeux.",
    "Laissez le souffle redevenir naturel. Il n'y a plus rien à faire, simplement observer.",
    'Portez votre attention sur vos pieds. Laissez-les s\'ouvrir et devenir lourds. Relâchez les chevilles, les mollets, les genoux.',
    "Sentez l'arrière des cuisses se poser dans le sol. Le bassin s'abandonne, le bas du dos s'étale.",
    'Relâchez le ventre. À chaque expiration, il devient plus doux, plus calme.',
    "Laissez la poitrine s'ouvrir. Les épaules glissent loin des oreilles. Les bras sont lourds, jusqu'au bout des doigts.",
    "Relâchez la nuque, la mâchoire, la langue. Détendez les yeux, le front, l'espace entre les sourcils.",
    'Tout le corps est lourd et détendu. Restez ici, dans le silence, simplement présent.',
  ],
  retour: [
    'Doucement, approfondissez votre respiration. Bougez les doigts et les orteils.',
    "Étirez-vous comme vous en avez besoin, puis roulez sur le côté droit. Prenez votre temps avant de revenir en position assise.",
  ],
};
export const textesSavasana = () => [...SAVASANA.detente, ...SAVASANA.retour];
// Moments où dire chaque texte (en secondes depuis le début de la posture), selon sa durée
export function planSavasana(secondes) {
  if (secondes < 90) return [];
  const debut = 20;
  const finDetente = secondes - 70;
  const ecart = Math.max(25, (finDetente - debut) / (SAVASANA.detente.length - 1));
  const plan = SAVASANA.detente.map((texte, k) => ({ t: debut + k * ecart, texte })).filter((x) => x.t <= finDetente);
  return [...plan, { t: secondes - 50, texte: SAVASANA.retour[0] }, { t: secondes - 28, texte: SAVASANA.retour[1] }];
}
export const estRelaxationFinale = (etape) => etape?.phase === 'Relaxation';

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
// Texte envoyé à la synthèse vocale : nombres en toutes lettres (« 2 tours » → « deux tours »). Le filtre de Gemini
// bloque à tort certains textes courts écrits en chiffres. Le nom du fichier audio reste calculé sur le texte d'origine.
const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };
function enLettres(n) {
  if (n < 17) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  if (n >= 70) return String(n);
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DIZAINES[d] : u === 1 ? `${DIZAINES[d]} et un` : `${DIZAINES[d]}-${UNITES[u]}`;
}
// Corrections de prononciation (texte lu seulement, l'affichage ne change pas) :
// « Chat-vache » était lu « chatte-vache » à cause du trait d'union
const PRONONCIATIONS = [[/\b(c)hat-vache\b/gi, '$1hat, vache']];
export const corrigerPrononciation = (t) => PRONONCIATIONS.reduce((s, [motif, remplacement]) => s.replace(motif, remplacement), t);
export const estCorrige = (t) => PRONONCIATIONS.some(([motif]) => new RegExp(motif.source, motif.flags.replace('g', '')).test(t));

// (« 1 minute » → « une minute », mot féminin)
export const textePrononce = (texte) => {
  const t = corrigerPrononciation(texte);
  return t.replace(/\b\d{1,2}\b/g, (n, i) => {
    const mot = enLettres(Number(n));
    return /un$/.test(mot) && /^\s*(minute|respiration|seconde)/.test(t.slice(i + n.length)) ? `${mot}e` : mot;
  });
};

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
