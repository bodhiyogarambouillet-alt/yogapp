// Accès serveur à Supabase (fonctions Vercel), via l'API REST.
// Utilise la clé SECRÈTE (SUPABASE_SECRET_KEY) : elle contourne la RLS, ne jamais l'exposer au navigateur.
// Les clés secrètes s'envoient uniquement dans l'en-tête `apikey` (pas en `Authorization: Bearer`).
// Sans configuration, l'appli fonctionne avec les fichiers JSON locaux (repli).

import posturesLocales from '../src/data/postures.json' with { type: 'json' };

const url = () => (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const cleSecrete = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseConfigure = () => Boolean(url() && cleSecrete());

// Deux formats de clé secrète :
// - nouvelle clé `sb_secret_…` : uniquement dans l'en-tête `apikey` (refusée en Authorization) ;
// - ancienne clé `service_role` (JWT `eyJ…`) : dans `apikey` ET `Authorization: Bearer`,
//   sinon la requête est traitée comme anonyme et bloquée par la RLS.
const entetesCle = () => {
  const cle = cleSecrete();
  return cle.startsWith('eyJ') ? { apikey: cle, Authorization: `Bearer ${cle}` } : { apikey: cle };
};

async function rest(chemin, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${url()}/rest/v1/${chemin}`, {
    method,
    headers: {
      ...entetesCle(),
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} : ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? null : res.json();
}

// ---------- Bibliothèque de postures (cache mémoire de 5 minutes) ----------

let cache = { postures: null, expire: 0 };

export async function chargerPostures() {
  if (!supabaseConfigure()) return posturesLocales;
  if (cache.postures && Date.now() < cache.expire) return cache.postures;
  try {
    const lignes = await rest('postures?select=*&order=id');
    if (!lignes.length) return posturesLocales; // table vide : pas encore synchronisée
    const postures = lignes.map((p) => ({ ...p, minutes: p.minutes === null ? null : Number(p.minutes) }));
    cache = { postures, expire: Date.now() + 5 * 60 * 1000 };
    return postures;
  } catch (e) {
    console.warn(`[supabase] postures indisponibles, repli sur le JSON local : ${e.message}`);
    return posturesLocales;
  }
}

// ---------- Fiches « Comment faire ? » (cache partagé) ----------

export async function lireFicheStockee(id) {
  if (!supabaseConfigure()) return null;
  const lignes = await rest(`fiches?posture_id=eq.${encodeURIComponent(id)}&select=*`);
  return lignes[0] || null;
}

// Enregistre une fiche générée — sans jamais écraser une fiche validée
export async function enregistrerFicheGeneree(id, contenu, modele) {
  if (!supabaseConfigure()) return;
  const existante = await lireFicheStockee(id);
  if (existante?.statut === 'validee') return;
  await rest('fiches?on_conflict=posture_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { posture_id: id, contenu, statut: 'generee', modele },
  });
}

// ---------- Utilisateur connecté (jeton envoyé par le navigateur) ----------

export async function utilisateurDepuisRequete(req) {
  if (!supabaseConfigure()) return null;
  const entete = req.headers?.authorization || req.headers?.Authorization || '';
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : '';
  if (!jeton) return null;
  const res = await fetch(`${url()}/auth/v1/user`, { headers: { apikey: cleSecrete(), Authorization: `Bearer ${jeton}` } });
  if (!res.ok) return null;
  const user = await res.json();
  const email = (user.email || '').toLowerCase();
  const admins = email ? await rest(`admins?email=eq.${encodeURIComponent(email)}&select=email`) : [];
  return { id: user.id, email, admin: admins.length > 0 };
}
