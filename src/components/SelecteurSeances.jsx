import { useMemo, useState } from 'react';
import { Fermer } from './Icones.jsx';
import { dateDe, dateLisible } from '../dates.js';
import { useRetour } from '../natif.js';

// Choix des séances dont les postures sont à éviter : plein écran, recherche, filtre par style, groupes par mois.
const sansAccents = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mois = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 'Sans date');

export default function SelecteurSeances({ seances, choisies, onValider, onFermer }) {
  const [selection, setSelection] = useState(choisies);
  const [recherche, setRecherche] = useState('');
  const [style, setStyle] = useState(null);
  useRetour(true, onFermer, 3);

  const styles = useMemo(() => [...new Set(seances.map((s) => s.style).filter(Boolean))], [seances]);
  const groupes = useMemo(() => {
    const q = sansAccents(recherche.trim());
    const filtrees = seances.filter((s) => (!style || s.style === style)
      && (!q || sansAccents([s.titre, s.style, s.niveau, dateLisible(dateDe(s))].join(' ')).includes(q)));
    const parMois = new Map();
    for (const s of filtrees) {
      const m = mois(dateDe(s));
      if (!parMois.has(m)) parMois.set(m, []);
      parMois.get(m).push(s);
    }
    return [...parMois];
  }, [seances, recherche, style]);

  const basculer = (uid) => setSelection((sel) => (sel.includes(uid) ? sel.filter((x) => x !== uid) : [...sel, uid]));

  return (
    <div className="selecteur" role="dialog" aria-modal="true" aria-label="Séances à éviter">
      <header className="selecteur-haut">
        <button type="button" className="rond" aria-label="Fermer" onClick={onFermer}><Fermer /></button>
        <h2>Séances à éviter</h2>
        <span className="cale" />
      </header>
      <p className="etape-aide selecteur-aide">Les postures des séances choisies seront évitées autant que possible.</p>

      <div className="selecteur-outils">
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher : titre, style, mois…" aria-label="Rechercher une séance" />
        {styles.length > 1 && (
          <div className="selecteur-filtres" role="group" aria-label="Filtrer par style">
            <button type="button" className={`badge choix ${!style ? 'actif' : ''}`} aria-pressed={!style} onClick={() => setStyle(null)}>Toutes</button>
            {styles.map((s) => (
              <button type="button" key={s} className={`badge choix ${style === s ? 'actif' : ''}`} aria-pressed={style === s}
                onClick={() => setStyle(style === s ? null : s)}>{s}</button>
            ))}
          </div>
        )}
      </div>

      <div className="selecteur-liste">
        {groupes.length === 0 && <p className="aide selecteur-vide">Aucune séance ne correspond.</p>}
        {groupes.map(([m, liste]) => (
          <section key={m} className="selecteur-groupe">
            <h3>{m}</h3>
            {liste.map((s) => {
              const coche = selection.includes(s.uid);
              return (
                <button type="button" key={s.uid} className={`exclusion ${coche ? 'actif' : ''}`} aria-pressed={coche} onClick={() => basculer(s.uid)}>
                  <span className="exclusion-case" aria-hidden="true">{coche ? '✓' : ''}</span>
                  <span className="exclusion-texte">
                    <span className="exclusion-titre">{s.titre || `${s.style} · ${s.duree} min`}</span>
                    <span className="exclusion-infos">{[`${s.style} · ${s.duree} min`, dateLisible(dateDe(s))].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <footer className="selecteur-pied">
        <button type="button" className="secondaire" onClick={() => setSelection([])} disabled={!selection.length}>Tout effacer</button>
        <button type="button" className="principal" onClick={() => onValider(selection)}>
          {selection.length ? `Valider (${selection.length})` : 'Valider'}
        </button>
      </footer>
    </div>
  );
}
