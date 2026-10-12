// Accès Supabase pour les scripts lancés sur votre ordinateur (clé secrète lue dans .env.local).
// La clé secrète ne quitte jamais votre machine : elle n'est ni dans le code ni sur GitHub.

try {
  process.loadEnvFile('.env.local');
} catch {
  /* pas de .env.local : Supabase non configuré */
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const cle = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Appel à l'API d'administration des comptes (création / mise à jour d'un utilisateur)
export async function auth(chemin, { method = 'GET', body } = {}) {
  const res = await fetch(`${url}/auth/v1/${chemin}`, {
    method,
    headers: { ...entetesCle(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase auth ${res.status} : ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

export const supabaseConfigure = Boolean(url && cle);

// Deux formats de clé secrète :
// - nouvelle clé `sb_secret_…` : uniquement dans l'en-tête `apikey` (refusée en Authorization) ;
// - ancienne clé `service_role` (JWT `eyJ…`) : dans `apikey` ET `Authorization: Bearer`,
//   sinon la requête est traitée comme anonyme et bloquée par la RLS.
const entetesCle = () => (cle.startsWith('eyJ') ? { apikey: cle, Authorization: `Bearer ${cle}` } : { apikey: cle });


export async function rest(chemin, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${url}/rest/v1/${chemin}`, {
    method,
    headers: { ...entetesCle(), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} : ${(await res.text()).slice(0, 400)}`);
  // Réponse vide possible (Prefer: return=minimal), quel que soit le code de succès
  const texte = await res.text();
  return texte ? JSON.parse(texte) : null;
}

// Insère ou met à jour par paquets de 100
export async function upsert(table, lignes, conflit) {
  for (let i = 0; i < lignes.length; i += 100) {
    await rest(`${table}?on_conflict=${conflit}`, {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: lignes.slice(i, i + 100),
    });
  }
}

// Stockage de fichiers (buckets) : création de bucket, envoi d'un fichier
export async function stockage(chemin, { method = 'GET', body, entetes = {} } = {}) {
  const res = await fetch(`${url}/storage/v1/${chemin}`, { method, headers: { ...entetesCle(), ...entetes }, body });
  const texte = await res.text();
  if (!res.ok) {
    const e = new Error(`Supabase stockage ${res.status} : ${texte.slice(0, 400)}`);
    e.statut = res.status;
    e.texte = texte;
    throw e;
  }
  return texte ? JSON.parse(texte) : null;
}
export const urlPublique = (bucket, nom) => `${url}/storage/v1/object/public/${bucket}/${nom}`;
