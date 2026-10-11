// Adresse des fonctions /api : relative sur le site, absolue dans l'appli Android
// (l'interface y est embarquée, les fonctions restent sur Vercel — voir .env.capacitor).
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
export const urlApi = (chemin) => `${BASE}${chemin}`;
