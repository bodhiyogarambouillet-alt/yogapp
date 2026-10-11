// Appel à l'API Gemini (REST) avec sortie JSON contrainte par un schéma.
// Modèle principal : gemini-3.8-flash. Si la réponse tarde trop (délai dépassé)
// ou si le modèle échoue (surcharge, erreur serveur, JSON illisible),
// on bascule sur le modèle de secours : gemini-3.5-flash-lite.
// Les deux se changent via GEMINI_MODEL et GEMINI_MODEL_SECOURS.

const MODELE_PRINCIPAL = 'gemini-3.8-flash';
const MODELE_SECOURS = 'gemini-3.5-flash-lite';

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

class ErreurDefinitive extends Error {}

async function appeler(modele, { system, prompt, schema, temperature }, delaiMs) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`;
  const controleur = new AbortController();
  const minuteur = delaiMs ? setTimeout(() => controleur.abort(), delaiMs) : null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controleur.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
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
      throw new Error(`Gemini ${res.status} : ${detail}`);
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
  if (!hasGeminiKey()) throw new Error('GEMINI_API_KEY manquante');
  const principal = process.env.GEMINI_MODEL || MODELE_PRINCIPAL;
  const secours = process.env.GEMINI_MODEL_SECOURS || MODELE_SECOURS;
  const requete = { system, prompt, schema, temperature };

  try {
    const donnees = await appeler(principal, requete, delaiMs);
    return { donnees, modele: principal, secours: false };
  } catch (e) {
    if (e instanceof ErreurDefinitive || secours === principal) throw e;
    console.warn(`[gemini] ${principal} : ${e.message} → bascule sur ${secours}`);
    // Le modèle Lite est rapide : on lui laisse le même délai, sans nouvelle bascule
    const donnees = await appeler(secours, requete, delaiMs);
    return { donnees, modele: secours, secours: true };
  }
}
