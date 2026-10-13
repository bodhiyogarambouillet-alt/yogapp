import { useEffect, useState } from 'react';
import { Note } from './Icones.jsx';
import { STYLES_MUSIQUE, creerPlaylist, retirerPlaylist, enregistrerDansSpotify } from '../musique.js';
import { etatSpotify, surSpotify, connecterSpotify } from '../spotify.js';
import { estNatif } from '../natif.js';

// Carte « Musique de la séance » : choix du style, sélection de morceaux par phase (jouée pendant la séance),
// enregistrement facultatif en playlist Spotify. Repliée par défaut ; la sélection est gardée avec la séance.
const ETAPES_BASE = ['Choix des morceaux…', 'Recherche sur Spotify…'];
const CREATION = 'Création de la playlist…';

// Pendant la création : égaliseur animé et étapes qui se cochent
function Chargement({ etape, enregistrer }) {
  const ETAPES = enregistrer || etape === CREATION ? [...ETAPES_BASE, CREATION] : ETAPES_BASE;
  const k = Math.max(0, ETAPES.indexOf(etape));
  return (
    <div className="musique-chargement" role="status" aria-live="polite">
      <div className="egaliseur" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
      <ol>
        {ETAPES.map((e, i) => <li key={e} className={i < k ? 'faite' : i === k ? 'en-cours' : ''}>{i < k ? '✓ ' : ''}{e.replace('…', '')}</li>)}
      </ol>
    </div>
  );
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export default function Musique({ seance, onChange }) {
  const playlist = seance.playlist || null;
  const [ouvert, setOuvert] = useState(false);
  const [spotify, setSpotify] = useState(etatSpotify);
  const [style, setStyle] = useState(playlist?.style && STYLES_MUSIQUE.includes(playlist.style) ? playlist.style : playlist?.style ? 'Autre' : 'Relaxation');
  const [autre, setAutre] = useState(playlist?.style && !STYLES_MUSIQUE.includes(playlist.style) ? playlist.style : '');
  const [sansParoles, setSansParoles] = useState(playlist?.sansParoles ?? true);
  const [enregistrer, setEnregistrer] = useState(false); // aussi enregistrer la sélection en playlist Spotify
  const [enCours, setEnCours] = useState(null); // message de progression
  const [erreur, setErreur] = useState(null);
  useEffect(() => surSpotify(setSpotify), []);

  const styleChoisi = style === 'Autre' ? autre.trim() : style;
  const creer = async (eviter = []) => {
    if (!styleChoisi) { setErreur('Indiquez un style de musique.'); return; }
    setErreur(null);
    setEnCours('Préparation…');
    try {
      const nouvelle = await creerPlaylist(seance, { style: styleChoisi, sansParoles, eviter, enregistrer }, setEnCours);
      if (eviter.length && playlist?.uri) retirerPlaylist(playlist);
      onChange({ ...seance, playlist: nouvelle });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };
  const autreSelection = () => creer((playlist?.morceaux || []).map((m) => `${m.titre} — ${m.artiste}`));
  // Enregistrer plus tard la sélection actuelle en playlist Spotify
  const enregistrerMaintenant = async () => {
    setErreur(null);
    try {
      setEnCours(CREATION);
      onChange({ ...seance, playlist: await enregistrerDansSpotify(seance, playlist, setEnCours) });
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  const phases = playlist ? [...new Set(playlist.morceaux.map((m) => m.phase))] : [];
  const resume = playlist ? `${playlist.morceaux.length} titres · ${Math.round(playlist.duree / 60)} min · ${playlist.style}` : 'Choisir une musique pour la séance';

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
                <p className="aide">Connectez votre compte Spotify pour choisir une musique adaptée à la séance.</p>
                <button type="button" className="bouton-spotify" onClick={() => connecterSpotify().catch((e) => setErreur(e.message))}>Connecter Spotify</button>
              </>
            ) : <p className="aide">Connectez votre compte Spotify dans l'écran Compte pour choisir une musique adaptée à la séance.</p>
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
                <input type="checkbox" role="switch" className="interrupteur" checked={sansParoles} disabled={Boolean(enCours)} onChange={(e) => setSansParoles(e.target.checked)} />
              </label>
              <label className="musique-option">
                <span>Enregistrer aussi en playlist dans Spotify</span>
                <input type="checkbox" role="switch" className="interrupteur" checked={enregistrer} disabled={Boolean(enCours)} onChange={(e) => setEnregistrer(e.target.checked)} />
              </label>
              {erreur && <p className="erreur" role="alert">{erreur}</p>}
              {enCours ? <Chargement etape={enCours} enregistrer={enregistrer} /> : (
                <button type="button" className={playlist ? 'secondaire' : 'principal'} onClick={() => creer()}>
                  {playlist ? 'Nouvelle sélection avec ce style' : 'Composer la musique'}
                </button>
              )}
            </>
          )}

          {playlist && (
            <div className="musique-playlist">
              <div className="musique-playlist-tete">
                <strong>{playlist.nom}</strong>
                <span>{resume}{playlist.uri ? ' · enregistrée dans Spotify' : ' · jouée pendant la séance'}</span>
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
                {playlist.url
                  ? <a className="principal ouvrir-spotify" href={playlist.url} target="_blank" rel="noopener noreferrer">Ouvrir dans Spotify</a>
                  : <button type="button" className="principal ouvrir-spotify" disabled={Boolean(enCours) || !spotify.connecte} onClick={enregistrerMaintenant}>Enregistrer dans Spotify</button>}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
