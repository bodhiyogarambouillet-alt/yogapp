// Appel à l'API Gemini (REST) avec sortie JSON contrainte par un schéma.
// Modèle principal : gemini-3.8-flash. Si la réponse tarde trop (délai dépassé)
// ou si le modèle échoue (surcharge, erreur serveur, JSON illisible),
// on bascule sur le modèle de secours : gemini-3.5-flash-lite.
// Les deux se changent via GEMINI_MODEL et GEMINI_MODEL_SECOURS.
// Quota atteint (429) sur la clé principale (GEMINI_API_KEY) : on recommence avec la clé d'un second projet
// (GEMINI_API_KEY_SECOURS), qui a son propre quota.

const MODELE_PRINCIPAL = 'gemini-3.8-flash';
const MODELE_SECOURS = 'gemini-3.5-flash-lite';

// Clés Gemini dans l'ordre : principale, puis de secours (autre projet Google, quota séparé)
export const clesGemini = () => [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_SECOURS].filter(Boolean);

export function hasGeminiKey() {
  return clesGemini().length > 0;
}

class ErreurDefinitive extends Error {}

async function appeler(modele, { system, prompt, schema, temperature }, delaiMs, cle) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`;
  const controleur = new AbortController();
  const minuteur = delaiMs ? setTimeout(() => controleur.abort(), delaiMs) : null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controleur.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      // Clé invalide ou refusée : inutile d'essayer un autre modèle
      if (res.status === 401 || res.status === 403) throw new ErreurDefinitive(`Gemini ${res.status} : ${detail}`);
      const erreur = new Error(`Gemini ${res.status} : ${detail}`);
      erreur.statut = res.status;
      throw erreur;
    }
    const data = await res.json();
    const texte = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    try {
      return JSON.parse(texte);
    } catch {
      throw new Error('Réponse Gemini illisible (JSON invalide)');
    }
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`délai de ${Math.round(delaiMs / 1000)} s dépassé`);
    throw e;
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

/**
 * Appelle Gemini avec bascule automatique sur le modèle de secours.
 * Retourne { donnees, modele, secours } pour savoir quel modèle a répondu.
 * delaiMs : temps laissé au modèle principal avant de basculer.
 */
export async function callGemini({ system, prompt, schema, temperature = 0.7, delaiMs = 20000 }) {
  const cles = clesGemini();
  if (!cles.length) throw new Error('GEMINI_API_KEY manquante');
  let derniere;
  for (const [n, cle] of cles.entries()) {
    try {
      return await avecCle(cle, { system, prompt, schema, temperature, delaiMs });
    } catch (e) {
      derniere = e;
      // Seul un quota atteint justifie d'essayer la clé suivante
      if (e.statut !== 429 || n === cles.length - 1) throw e;
      console.warn('[gemini] quota atteint sur la clé principale → clé de secours');
    }
  }
  throw derniere;
}

async function avecCle(cle, { system, prompt, schema, temperature, delaiMs }) {
  const principal = process.env.GEMINI_MODEL || MODELE_PRINCIPAL;
  const secours = process.env.GEMINI_MODEL_SECOURS || MODELE_SECOURS;
  const requete = { system, prompt, schema, temperature };

  try {
    const donnees = await appeler(principal, requete, delaiMs, cle);
    return { donnees, modele: principal, secours: false };
  } catch (e) {
    if (e instanceof ErreurDefinitive || secours === principal) throw e;
    console.warn(`[gemini] ${principal} : ${e.message} → bascule sur ${secours}`);
    // Le modèle Lite est rapide : on lui laisse le même délai, sans nouvelle bascule. Si lui aussi est en quota,
    // l'erreur (statut 429) fait passer à la clé suivante
    const donnees = await appeler(secours, requete, delaiMs, cle);
    return { donnees, modele: secours, secours: true };
  }
}
