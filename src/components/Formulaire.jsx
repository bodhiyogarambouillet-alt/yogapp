import { useState } from 'react';
import { STYLES, DUREES, PAR_ID } from '../bibliotheque.js';
import { Logo, Livre, Cible } from './Icones.jsx';
import ChoixCible from './ChoixCible.jsx';

// Les 6 styles les plus courants en tuiles, les autres derrière « + n autres styles »
const PRINCIPAUX = ['Hatha', 'De Gasquet', 'Yin', 'Doux / seniors', 'Yoga du dos', 'Prénatal'];
const COURT = { 'Doux / seniors': 'Doux', 'Yoga du dos': 'Dos' };
const NIVEAUX = [['Débutant', 'Débutant'], ['Intermédiaire', 'Inter.'], ['Avancé', 'Avancé']];

export default function Formulaire({ initial, chargement, erreur, onGenerer, onMesSeances }) {
  const [style, setStyle] = useState(initial?.style || 'Hatha');
  const [duree, setDuree] = useState(initial?.duree || 45);
  const [niveau, setNiveau] = useState(initial?.niveau || 'Intermédiaire');
  const [theme, setTheme] = useState(initial?.theme || '');
  const [cible, setCible] = useState(initial?.cibleId ? PAR_ID.get(initial.cibleId) || null : null);
  const [tousStyles, setTousStyles] = useState(!PRINCIPAUX.includes(initial?.style || 'Hatha'));
  const [eviter, setEviter] = useState(initial?.eviterRepetition || 0); // 0 = désactivé, sinon nombre de séances précédentes
  const [options, setOptions] = useState(Boolean(initial?.cibleId || initial?.theme || initial?.eviterRepetition));

  const autres = STYLES.filter((s) => !PRINCIPAUX.includes(s));
  const visibles = tousStyles ? [...PRINCIPAUX, ...autres] : PRINCIPAUX;

  const soumettre = (e) => {
    e.preventDefault();
    if (!chargement) onGenerer({ style, duree, niveau, theme: theme.trim(), cibleId: cible?.id || null, eviterRepetition: eviter });
  };

  return (
    <form className="ecran" onSubmit={soumettre}>
      <div className="decor-arche" aria-hidden="true" />
      <div className="decor-soleil" aria-hidden="true" />

      <header className="entete">
        <div className="marque"><span className="accent"><Logo /></span><span>Mes séances Yoga</span></div>
        <button type="button" className="rond" aria-label="Mes séances" onClick={onMesSeances}><Livre /></button>
      </header>

      <section className="bloc">
        <h1>Prépare<br />ton prochain cours</h1>
      </section>

      <fieldset className="bloc">
        <legend className="etiquette">Style</legend>
        <div className="tuiles">
          {visibles.map((s) => (
            <button type="button" key={s} aria-pressed={s === style}
              className={`tuile ${PRINCIPAUX.includes(s) ? '' : 'petite'} ${s === style ? 'actif' : ''}`}
              onClick={() => setStyle(s)}>
              {COURT[s] || s}
            </button>
          ))}
        </div>
        <button type="button" className="lien" aria-expanded={tousStyles} onClick={() => setTousStyles(!tousStyles)}>
          {tousStyles ? 'Moins de styles' : `+ ${autres.length} autres styles`}
        </button>
      </fieldset>

      <fieldset className="bloc" style={{ paddingTop: 12 }}>
        <legend className="etiquette">Durée <span className="facultatif">(minutes)</span></legend>
        <div className="durees">
          {DUREES.map((d) => (
            <button type="button" key={d} className={`duree ${d === duree ? 'actif' : ''}`}
              aria-pressed={d === duree} aria-label={`${d} minutes`} onClick={() => setDuree(d)}>{d}</button>
          ))}
        </div>
      </fieldset>

      <fieldset className="bloc" style={{ paddingTop: 18 }}>
        <legend className="etiquette">Niveau</legend>
        <div className="niveaux">
          {NIVEAUX.map(([nom, court]) => (
            <button type="button" key={nom} className={`niveau ${nom === niveau ? 'actif' : ''}`}
              aria-pressed={nom === niveau} aria-label={nom} onClick={() => setNiveau(nom)}>{court}</button>
          ))}
        </div>
      </fieldset>

      <section className="bloc" style={{ paddingTop: 20 }}>
        <button type="button" className="ouvrir-options" aria-expanded={options} onClick={() => setOptions(!options)}>
          <span className="accent"><Cible /></span>
          <span>Viser une posture <span>· thème · facultatif</span></span>
        </button>
        {options && (
          <div className="options">
            <label htmlFor="cible" className="etiquette">Posture cible</label>
            <ChoixCible cible={cible} onChange={setCible} style={style} niveau={niveau} />
            <label htmlFor="theme" className="etiquette">Thème ou contraintes</label>
            <textarea id="theme" rows="2" maxLength={500} value={theme} onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex. : ancrage, deux élèves aux lombaires fragiles" />
            <span className="etiquette">Éviter les répétitions</span>
            <div className="niveaux" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="group" aria-label="Éviter les postures des séances précédentes">
              {[[0, 'Non'], [1, 'Dernière'], [3, '3 dernières'], [5, '5 dernières']].map(([n, nom]) => (
                <button type="button" key={n} className={`niveau ${n === eviter ? 'actif' : ''}`} aria-pressed={n === eviter}
                  onClick={() => setEviter(n)}>{nom}</button>
              ))}
            </div>
            {eviter > 0 && <p className="aide">Les postures de vos séances enregistrées les plus récentes sont évitées autant que possible.</p>}
          </div>
        )}
      </section>

      <div className="ressort" />

      <footer className="pied colonne">
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <button type="submit" className="composer" disabled={chargement}>
          <span>{chargement ? 'Composition…' : 'Composer'}</span>
          <small>{COURT[style] || style} · {duree}′{cible ? ` · ${cible.fr}` : ''} →</small>
        </button>
      </footer>
    </form>
  );
}
