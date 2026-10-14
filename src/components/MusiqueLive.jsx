import { useCallback, useEffect, useRef, useState } from 'react';
import { appelSpotify, etatSpotify } from '../spotify.js';
import { estNatif } from '../natif.js';
import { ouvrirSpotify } from '../seance-live.js';

// Musique pendant la séance en direct : la sélection de la séance démarre avec le minuteur,
// se met en pause et reprend avec lui, et le morceau en cours s'affiche au-dessus des commandes.
// Le pilotage de la lecture demande Spotify Premium et l'appli Spotify ouverte récemment sur un appareil.

// Appareil où jouer : celui déjà actif, sinon le téléphone (ou le premier) où Spotify est ouvert
async function appareil() {
  const d = await appelSpotify('/me/player/devices');
  const liste = (d?.devices || []).filter((x) => !x.is_restricted);
  return liste.find((x) => x.is_active) || liste.find((x) => x.type === 'Smartphone') || liste[0] || null;
}

// Dans l'appli Android, la musique part sur le téléphone, même si un autre appareil (ordinateur, enceinte) était actif.
// Spotify ne dit pas lequel de ses appareils est ce téléphone : on prend le premier smartphone où Spotify est ouvert.
async function telephone() {
  const d = await appelSpotify('/me/player/devices');
  return (d?.devices || []).find((x) => !x.is_restricted && x.type === 'Smartphone') || null;
}

// Ce qu'on demande à Spotify de jouer : la playlist si elle est enregistrée, sinon les morceaux dans l'ordre
const contenu = (playlist) => (playlist.uri ? { context_uri: playlist.uri } : { uris: playlist.morceaux.map((m) => m.uri) });

const messageErreur = (e) => (e.raison === 'PREMIUM_REQUIRED' || e.statut === 403
  ? 'Lecture automatique réservée à Spotify Premium.'
  : e.raison === 'NO_ACTIVE_DEVICE' || e.statut === 404
    ? 'Ouvrez Spotify sur le téléphone, puis relancez.'
    : `Spotify : ${e.message}`);

export function useMusiqueLive(playlist, enCours, terminee) {
  const actif = Boolean(playlist?.morceaux?.length && etatSpotify().connecte);
  const [morceau, setMorceau] = useState(null); // { titre, artiste, image, joue }
  const [erreur, setErreur] = useState(null);
  const demarree = useRef(false); // la playlist a été lancée par la séance
  // Spotify absent des appareils du téléphone : bouton « Ouvrir Spotify », puis nouvel essai au retour dans l'appli
  const [absent, setAbsent] = useState(false);
  const [essai, setEssai] = useState(0);
  useEffect(() => {
    if (!absent) return undefined;
    // Spotify met parfois quelques secondes à apparaître : deux essais
    const auRetour = () => {
      if (document.visibilityState !== 'visible') return;
      setTimeout(() => setEssai((n) => n + 1), 1200);
      setTimeout(() => setEssai((n) => n + 1), 4500);
    };
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, [absent]);
  const file = useRef(Promise.resolve()); // les ordres lecture / pause partent l'un après l'autre

  const lireEnCours = useCallback(async () => {
    try {
      const d = await appelSpotify('/me/player/currently-playing');
      const it = d?.item;
      setMorceau(it ? {
        titre: it.name, artiste: (it.artists || []).map((a) => a.name).join(', '),
        image: it.album?.images?.at(-1)?.url || null, joue: Boolean(d.is_playing),
      } : null);
    } catch { /* affichage seulement : on réessaiera au prochain tour */ }
  }, []);

  // Lecture / pause au rythme du minuteur
  useEffect(() => {
    if (!actif) return;
    const lancer = async () => {
      try {
        if (enCours) {
          const corps = demarree.current ? undefined : contenu(playlist);
          if (estNatif && !demarree.current) {
            const t = await telephone();
            if (!t) { setAbsent(true); setErreur('Spotify n\'est pas ouvert sur ce téléphone.'); return; }
            await appelSpotify(`/me/player/play?device_id=${encodeURIComponent(t.id)}`, { method: 'PUT', body: corps });
            demarree.current = true;
            setAbsent(false);
            setErreur(null);
            return;
          }
          try {
            await appelSpotify('/me/player/play', { method: 'PUT', body: corps });
          } catch (e) {
            // Aucun appareil actif : on réveille celui où Spotify est ouvert
            if (e.raison !== 'NO_ACTIVE_DEVICE' && e.statut !== 404) throw e;
            const a = await appareil();
            if (!a) throw e;
            await appelSpotify(`/me/player/play?device_id=${encodeURIComponent(a.id)}`, { method: 'PUT', body: contenu(playlist) });
          }
          demarree.current = true;
          setErreur(null);
        } else if (demarree.current) {
          await appelSpotify('/me/player/pause', { method: 'PUT' });
        }
      } catch (e) {
        if (enCours) setErreur(messageErreur(e));
      } finally {
        setTimeout(lireEnCours, 800);
      }
    };
    file.current = file.current.then(lancer);
  }, [actif, enCours, playlist, lireEnCours, essai]);

  // Fin de séance : la musique s'arrête
  useEffect(() => {
    if (actif && terminee && demarree.current) appelSpotify('/me/player/pause', { method: 'PUT' }).catch(() => {});
  }, [actif, terminee]);

  // Morceau en cours, relu régulièrement ; en quittant le direct, la musique lancée par la séance s'arrête
  useEffect(() => {
    if (!actif) return undefined;
    lireEnCours();
    const t = setInterval(lireEnCours, 5000);
    return () => {
      clearInterval(t);
      if (demarree.current) appelSpotify('/me/player/pause', { method: 'PUT' }).catch(() => {});
    };
  }, [actif, lireEnCours]);

  const suivant = async () => {
    try {
      await appelSpotify('/me/player/next', { method: 'POST' });
      setTimeout(lireEnCours, 600);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  };

  return { actif, morceau, erreur, absent, suivant };
}

export function CarteMorceau({ musique, playlist }) {
  if (!musique.actif) return null;
  const { morceau, erreur, absent, suivant } = musique;
  return (
    <section className="live-musique" aria-label="Musique">
      <span className="etiquette">Musique</span>
      <div className="morceau-live" role="status" aria-live="polite">
      {morceau?.image ? <img src={morceau.image} alt="" width="40" height="40" /> : <span className="morceau-pochette" aria-hidden="true">♪</span>}
      <span className="morceau-texte">
        {erreur ? (
          <>
            <span className="morceau-titre">{erreur}</span>
            {absent
              ? <button type="button" className="morceau-ouvrir lien" onClick={ouvrirSpotify}>Ouvrir Spotify</button>
              : playlist.url && <a className="morceau-ouvrir" href={playlist.url} target="_blank" rel="noopener noreferrer">Ouvrir dans Spotify</a>}
          </>
        ) : morceau ? (
          <>
            <span className="morceau-titre">{morceau.titre}</span>
            <span className="morceau-artiste">{morceau.artiste}</span>
          </>
        ) : (
          <>
            <span className="morceau-titre">{playlist.nom}</span>
            <span className="morceau-artiste">Démarre avec la séance</span>
          </>
        )}
      </span>
      {morceau && !erreur && (
        <button type="button" className="morceau-suivant" aria-label="Morceau suivant" onClick={suivant}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l8 6-8 6z" /><path d="M18 6v12" /></svg>
        </button>
      )}
      </div>
    </section>
  );
}
