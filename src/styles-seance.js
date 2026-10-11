// Styles d'une séance : aucun (séance libre, toutes les postures), un seul, ou un mélange de plusieurs.
// Partagé entre le navigateur et les fonctions serveur.

export const libelleStyles = (styles) => (styles?.length ? styles.join(' + ') : 'Tous styles');

// Séances enregistrées avant le mélange de styles : seul `style` (texte) existe
export const stylesDe = (seance) => (Array.isArray(seance?.styles) ? seance.styles : seance?.style && seance.style !== 'Tous styles' ? [seance.style] : []);

// Une posture convient si aucun style n'est imposé, ou si elle appartient à au moins un des styles choisis
export const convientAuxStyles = (posture, styles) => !styles?.length || styles.some((s) => posture.styles.includes(s));
