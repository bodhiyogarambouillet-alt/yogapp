import { useEffect, useState } from 'react';
import { Note } from './Icones.jsx';
import { STYLES_MUSIQUE, creerPlaylist, retirerPlaylist } from '../musique.js';
import { etatSpotify, surSpotify, connecterSpotify } from '../spotify.js';
import { estNatif } from '../natif.js';

// Carte « Musique de la séance » : choix du style, création de la playlist Spotify, aperçu par phase.
// Repliée par défaut ; la playlist créée est gardée avec la séance.
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export default function Musique({ seance, onChange }) {
  const playlist = seance.playlist || null;
  const [ouvert, setOuvert] = useState(false);
  const [spotify, setSpotify] = useState(etatSpotify);
  const [style, setStyle] = useState(playlist?.style && STYLES_MUSIQUE.includes(playlist.style) ? playlist.style : playlist?.style ? 'Autre' : 'Relaxation');
  const [autre, setAutre] = useState(playlist?.style && !STYLES_MUSIQUE.includes(playlist.style) ? playlist.style : '');
  const [sansParoles, setSansParoles] = useState(playlist?.sansParoles ?? true);
  const [enCours, setEnCours] = useState(null); // message de progression
  const [erreur, setErreur] = useState(null);
  useEffect(() => surSpotify(setSpotify), []);

  const styleChoisi = style === 'Autre' ? autre.trim() : style;
  const creer = async (eviter = []) => {
    if (!styleChoisi) { setErreur('Indiquez un style de musique.'); return; }
    setErreur(null);
    setEnCours('Préparation…');
    try {
      const nouvelle = await creerPlaylist(seance, { style: styleChoisi, sansParoles, eviter }, setEnCours);
      if (eviter.length) retirerPlaylist(playlist);
      onChange({ ...seance, playlist: nouvelle });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };
  const autreSelection = () => creer((playlist?.morceaux || []).map((m) => `${m.titre} — ${m.artiste}`));

  const phases = playlist ? [...new Set(playlist.morceaux.map((m) => m.phase))] : [];
  const resume = playlist ? `${playlist.morceaux.length} titres · ${Math.round(playlist.duree / 60)} min · ${playlist.style}` : 'Créer une playlist Spotify';

  return (
    <section className={`musique ${ouvert ? 'ouvert' : ''}`}>
      <button type="button" className="musique-tete" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
        <span className="musique-icone"><Note /></span>
        <span className="musique-titres">
          <span className="musique-titre">Musique de la séance</span>
          <span className="musique-resume">{resume}</span>
        </span>
        <span className="musique-fleche" aria-hidden="true">▾</span>
      </button>

      {ouvert && (
        <div className="musique-corps">
          {!spotify.connecte ? (
            estNatif ? (
              <>
                <p className="aide">Connectez votre compte Spotify pour créer une playlist adaptée à la séance.</p>
                <button type="button" className="bouton-spotify" onClick={() => connecterSpotify().catch((e) => setErreur(e.message))}>Connecter Spotify</button>
              </>
            ) : <p className="aide">Connectez votre compte Spotify dans l'écran Compte pour créer une playlist adaptée à la séance.</p>
          ) : (
            <>
              <div className="badges musique-styles" role="group" aria-label="Style de musique">
                {[...STYLES_MUSIQUE, 'Autre'].map((s) => (
                  <button type="button" key={s} className={`badge choix ${style === s ? 'actif' : ''}`} aria-pressed={style === s}
                    disabled={Boolean(enCours)} onClick={() => setStyle(s)}>{s === 'Autre' ? 'Autre…' : s}</button>
                ))}
              </div>
              {style === 'Autre' && (
                <input type="text" className="musique-autre" value={autre} onChange={(e) => setAutre(e.target.value)} maxLength={80}
                  placeholder="Jazz doux, musique indienne, Ludovico Einaudi…" aria-label="Style de musique personnalisé" />
              )}
              <label className="musique-option">
                <span>Sans paroles</span>
                <input type="checkbox" role="switch" checked={sansParoles} disabled={Boolean(enCours)} onChange={(e) => setSansParoles(e.target.checked)} />
              </label>
              {erreur && <p className="erreur" role="alert">{erreur}</p>}
              <button type="button" className={playlist ? 'secondaire' : 'principal'} disabled={Boolean(enCours)} onClick={() => creer()}>
                {enCours || (playlist ? 'Nouvelle playlist avec ce style' : 'Créer la playlist')}
              </button>
            </>
          )}

          {playlist && (
            <div className="musique-playlist">
              <div className="musique-playlist-tete">
                <strong>{playlist.nom}</strong>
                <span>{resume}</span>
              </div>
              <ol className="musique-morceaux">
                {phases.map((ph) => (
                  <li key={ph}>
                    <span className="musique-phase">{ph}</span>
                    <ul>
                      {playlist.morceaux.filter((m) => m.phase === ph).map((m) => (
                        <li key={m.uri} className="musique-morceau">
                          {m.image ? <img src={m.image} alt="" width="36" height="36" loading="lazy" /> : <span className="musique-pochette" />}
                          <span className="ligne-texte">
                            <span className="musique-morceau-titre">{m.titre}</span>
                            <span className="ligne-infos">{m.artiste}</span>
                          </span>
                          <span className="duree-ligne">{mmss(m.duree)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <div className="musique-actions">
                <button type="button" className="secondaire" disabled={Boolean(enCours) || !spotify.connecte} onClick={autreSelection}>↻ Autre sélection</button>
                <a className="principal ouvrir-spotify" href={playlist.url} target="_blank" rel="noopener noreferrer">Ouvrir dans Spotify</a>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
