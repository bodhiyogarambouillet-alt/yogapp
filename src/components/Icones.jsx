const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const Retour = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M15 5l-7 7 7 7" /></svg>;
export const Imprimer = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M7 9V3h10v6" /><path d="M7 17H4V9h16v8h-3" /><path d="M7 14h10v7H7z" /></svg>;
export const Remplacer = () => <svg width="18" height="18" viewBox="0 0 24 24" {...base} strokeWidth="1.8"><path d="M4 8h13l-3-3" /><path d="M20 16H7l3 3" /></svg>;
export const Etincelle = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.5L12 15l-1.8-4.5L5.5 9l4.7-1.4z" /><path d="M18 15l.8 2 2 .8-2 .7-.8 2-.7-2-2-.7 2-.8z" /></svg>;
export const Attention = ({ label }) => <svg width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth="2" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}><path d="M12 3l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>;
export const Valide = () => <svg width="18" height="18" viewBox="0 0 24 24" {...base} strokeWidth="2"><path d="M5 12l5 5 9-10" /></svg>;
export const Livre = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></svg>;
export const Poubelle = () => <svg width="18" height="18" viewBox="0 0 24 24" {...base}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></svg>;
export const Cible = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base} strokeWidth="1.8"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>;
export const Points = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>;
export const Fermer = () => <svg width="18" height="18" viewBox="0 0 24 24" {...base} strokeWidth="1.8"><path d="M6 6l12 12M18 6L6 18" /></svg>;
// Soleil levant au-dessus de l'horizon
// Logo : ronds concentriques (une goutte dans l'eau), du sable au cœur terracotta — même dessin que les icônes de l'appli
export const Logo = () => <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12.5" fill="#EBDCC7" /><circle cx="14" cy="14" r="9" fill="#E5D0B4" /><circle cx="14" cy="14" r="5.5" fill="#DDBE98" /><circle cx="14" cy="14" r="2.5" fill="#A9472A" /></svg>;
export const Lecture = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>;
export const Pause = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" /></svg>;
export const Suivant = () => <svg width="22" height="22" viewBox="0 0 24 24" {...base} strokeWidth="1.8"><path d="M6 6l8 6-8 6z" /><path d="M18 6v12" /></svg>;
export const Precedent = () => <svg width="22" height="22" viewBox="0 0 24 24" {...base} strokeWidth="1.8"><path d="M18 6l-8 6 8 6z" /><path d="M6 6v12" /></svg>;
export const Oeil = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>;
export const OeilBarre = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M10.6 5.6A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4" /><path d="M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.5-.6 4.8-1.5" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></svg>;
// Logo « G » de Google (bouton de connexion)
export const Google = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.1z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6a24 24 0 0 0 0 21.4l7.8-6z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-10l-7.8 6C6.6 42.6 14.6 48 24 48z" />
  </svg>
);
export const Exporter = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>;
export const Utilisateur = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></svg>;
export const Agrandir = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M4 9V4h5" /><path d="M20 9V4h-5" /><path d="M4 15v5h5" /><path d="M20 15v5h-5" /></svg>;
export const Reduire = () => <svg width="20" height="20" viewBox="0 0 24 24" {...base}><path d="M9 4v5H4" /><path d="M15 4v5h5" /><path d="M9 20v-5H4" /><path d="M15 20v-5h5" /></svg>;
export const Note = () => <svg width="18" height="18" viewBox="0 0 24 24" {...base} strokeWidth="1.8"><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>;
