// Playlist Spotify d'une séance : Gemini propose (/api/proposer-musique), l'appli vérifie chaque morceau
// dans le catalogue Spotify, ajuste la durée phase par phase, complète si besoin, puis crée la playlist
// dans le compte de l'utilisateur.

import { urlApi } from './api.js';
import { appelSpotify } from './spotify.js';
import { nom } from './bibliotheque.js';

export const STYLES_MUSIQUE = ['Relaxation', 'Folk', 'Piano', 'Ambient', 'Bols chantants', 'Mantras', 'Nature', 'Lo-fi'];

const simple = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const TOLERANCE = 45; // secondes : on s'arrête dès que la phase est couverte à 45 s près

// Cherche un morceau précis ; ne garde le résultat que si l'artiste correspond
async function trouver({ titre, artiste }) {
  const q = `track:${titre.replace(/["']/g, ' ')} artist:${artiste.replace(/["']/g, ' ')}`;
  const r = await appelSpotify(`/search?${new URLSearchParams({ q, type: 'track', limit: '5' })}`);
  const a = simple(artiste);
  return (r?.tracks?.items || []).find((t) => t.is_playable !== false && t.artists.some((x) => simple(x.name).includes(a) || a.includes(simple(x.name)))) || null;
}

// Plusieurs recherches à la fois, sans dépasser `n` en parallèle (les erreurs sont gardées pour le diagnostic)
const erreurs = [];
async function parLots(liste, n, fn) {
  const resultats = new Array(liste.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, liste.length) }, async () => {
    while (i < liste.length) {
      const k = i++;
      resultats[k] = await fn(liste[k]).catch((e) => { erreurs.push(e.message); return null; });
    }
  }));
  return resultats;
}

const versMorceau = (t, phase) => ({
  uri: t.uri, id: t.id, phase, titre: t.name, artiste: t.artists.map((a) => a.name).join(', '),
  duree: Math.round(t.duration_ms / 1000), image: t.album?.images?.at(-1)?.url || null,
});

const nomPlaylist = (seance) => {
  const date = seance.dateSeance ? new Date(`${seance.dateSeance}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null;
  const total = seance.phases.reduce((s, ph) => s + ph.minutes, 0);
  return [seance.titre || seance.style || 'Séance de yoga', `${total}′`, date].filter(Boolean).join(' · ');
};

export async function creerPlaylist(seance, { style = 'Relaxation', sansParoles = false, eviter = [] } = {}, progression = () => {}) {
  progression('Choix des morceaux…');
  const r = await fetch(urlApi('/api/proposer-musique'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      style, sansParoles, eviter,
      seance: {
        style: seance.style, niveau: seance.niveau, titre: seance.titre, intention: seance.intention,
        phases: seance.phases.map((ph) => ({ phase: ph.phase, minutes: ph.minutes, postures: ph.items.map((it) => it.posture?.fr || nom(it.posture)) })),
      },
    }),
  });
  const propositions = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(propositions.erreur || `Erreur ${r.status}`);

  progression('Recherche sur Spotify…');
  erreurs.length = 0;
  const dejaPris = new Set();
  const morceaux = [];
  for (const ph of propositions.phases) {
    const cible = ph.minutes * 60;
    let duree = 0;
    const trouves = await parLots(ph.morceaux, 4, trouver);
    for (const t of trouves) {
      if (duree >= cible - TOLERANCE) break;
      if (!t || dejaPris.has(t.id)) continue;
      dejaPris.add(t.id);
      morceaux.push(versMorceau(t, ph.phase));
      duree += t.duration_ms / 1000;
    }
    // Pas assez de morceaux trouvés : on complète par mots-clés (genre + ambiance)
    for (let page = 0; duree < cible - TOLERANCE && page < 3; page++) {
      const res = await appelSpotify(`/search?${new URLSearchParams({ q: ph.motsCles, type: 'track', limit: '10', offset: String(page * 10) })}`)
        .catch((e) => { erreurs.push(e.message); return null; });
      const items = res?.tracks?.items || [];
      if (!items.length) break;
      for (const t of items) {
        if (duree >= cible - TOLERANCE) break;
        if (dejaPris.has(t.id) || t.duration_ms < 90000) continue;
        dejaPris.add(t.id);
        morceaux.push(versMorceau(t, ph.phase));
        duree += t.duration_ms / 1000;
      }
    }
  }
  if (!morceaux.length) {
    throw new Error(erreurs.length ? `La recherche Spotify a échoué : ${erreurs[0]}` : 'Aucun morceau trouvé sur Spotify, essayez un autre style.');
  }

  progression('Création de la playlist…');
  const playlist = await appelSpotify('/me/playlists', {
    method: 'POST',
    body: { name: nomPlaylist(seance), public: false, description: `Séance ${seance.style || 'de yoga'} · musique ${style.toLowerCase()} · Mes séances Yoga` },
  });
  for (let i = 0; i < morceaux.length; i += 100) {
    await appelSpotify(`/playlists/${playlist.id}/items`, { method: 'POST', body: { uris: morceaux.slice(i, i + 100).map((m) => m.uri) } });
  }
  return {
    id: playlist.id, uri: playlist.uri, url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
    nom: playlist.name, style, sansParoles, creeLe: new Date().toISOString(),
    duree: morceaux.reduce((s, m) => s + m.duree, 0),
    morceaux: morceaux.map(({ uri, phase, titre, artiste, duree, image }) => ({ uri, phase, titre, artiste, duree, image })),
  };
}

// Retire une ancienne playlist de la bibliothèque de l'utilisateur (« Autre sélection ») ; sans gravité si ça échoue
export async function retirerPlaylist(playlist) {
  if (!playlist?.uri) return;
  await appelSpotify(`/me/library?${new URLSearchParams({ uris: playlist.uri })}`, { method: 'DELETE' }).catch(() => {});
}
