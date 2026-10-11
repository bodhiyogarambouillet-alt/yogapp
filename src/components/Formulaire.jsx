import { useEffect, useRef, useState } from 'react';
import { STYLES, DUREES, PAR_ID, nom } from '../bibliotheque.js';
import { Logo, Livre, Cible } from './Icones.jsx';
import ChoixCible from './ChoixCible.jsx';
import { ACCESSOIRES } from '../accessoires.js';

// Les 6 styles les plus courants en tuiles, les autres derrière « + n autres styles »
const PRINCIPAUX = ['Hatha', 'De Gasquet', 'Yin', 'Doux / seniors', 'Yoga du dos', 'Prénatal'];
const COURT = { 'Doux / seniors': 'Doux', 'Yoga du dos': 'Dos' };
const NIVEAUX = [['Débutant', 'Débutant'], ['Intermédiaire', 'Inter.'], ['Avancé', 'Avancé']];

export default function Formulaire({ initial, chargement, erreur, onGenerer, onMesSeances }) {
  // Styles choisis : aucun = séance libre (toutes les postures), plusieurs = mélange
  const [styles, setStyles] = useState(initial?.styles || (initial?.style ? [initial.style] : ['Hatha']));
  const [duree, setDuree] = useState(initial?.duree || 45);
  const [niveau, setNiveau] = useState(initial?.niveau || 'Intermédiaire');
  const [theme, setTheme] = useState(initial?.theme || '');
  const [cible, setCible] = useState(initial?.cibleId ? PAR_ID.get(initial.cibleId) || null : null);
  const [tousStyles, setTousStyles] = useState(styles.some((s) => !PRINCIPAUX.includes(s)));
  // Accessoires disponibles : aucun par défaut (pratique sans matériel), sauf choix explicite reçu ; tous cochés = aucun filtre
  const [dispo, setDispo] = useState(Array.isArray(initial?.accessoires) ? initial.accessoires : []);
  const [eviter, setEviter] = useState(initial?.eviterRepetition || 0); // 0 = désactivé, sinon nombre de séances précédentes
  const [options, setOptions] = useState(Boolean(initial?.cibleId || initial?.theme || initial?.eviterRepetition));

  // Panneau d'options toujours présent (pour l'animation) mais inaccessible quand il est replié
  const panneau = useRef(null);
  useEffect(() => { panneau.current?.toggleAttribute('inert', !options); }, [options]);

  const autres = STYLES.filter((s) => !PRINCIPAUX.includes(s));
  const visibles = tousStyles ? [...PRINCIPAUX, ...autres] : PRINCIPAUX;

  const soumettre = (e) => {
    e.preventDefault();
    if (!chargement) onGenerer({ styles, duree, niveau, theme: theme.trim(), cibleId: cible?.id || null, eviterRepetition: eviter,
      accessoires: dispo.length === ACCESSOIRES.length ? null : dispo });
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
        <legend className="etiquette">Style <span className="facultatif">(un ou plusieurs, facultatif)</span></legend>
        <div className="tuiles">
          {visibles.map((s) => (
            <button type="button" key={s} aria-pressed={styles.includes(s)}
              className={`tuile ${PRINCIPAUX.includes(s) ? '' : 'petite'} ${styles.includes(s) ? 'actif' : ''}`}
              onClick={() => setStyles(styles.includes(s) ? styles.filter((x) => x !== s) : [...styles, s])}>
              {COURT[s] || s}
            </button>
          ))}
        </div>
        <button type="button" className="lien" aria-expanded={tousStyles} onClick={() => setTousStyles(!tousStyles)}>
          {tousStyles ? 'Moins de styles' : `+ ${autres.length} autres styles`}
        </button>
        <p className="aide">
          {styles.length === 0 ? 'Aucun style : la séance puise dans toutes les postures.'
            : styles.length === 1 ? 'Un seul style.' : `Mélange de ${styles.length} styles.`}
        </p>
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
        <button type="button" className={`ouvrir-options ${options ? 'ouvert' : ''}`} aria-expanded={options} aria-controls="panneau-options" onClick={() => setOptions(!options)}>
          <span className="accent"><Cible /></span>
          <span>Options <span>· posture cible, accessoires, thème</span></span>
          <span className="fleche-options" aria-hidden="true">▾</span>
        </button>
        <div id="panneau-options" ref={panneau} className={`repli-options ${options ? 'ouvert' : ''}`}>
          <div className="options">
            <label htmlFor="cible" className="etiquette">Posture cible</label>
            <ChoixCible cible={cible} onChange={setCible} styles={styles} niveau={niveau} />
            <label htmlFor="theme" className="etiquette">Thème ou contraintes</label>
            <textarea id="theme" rows="2" maxLength={500} value={theme} onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex. : ancrage, deux élèves aux lombaires fragiles" />
            <span className="etiquette">Accessoires disponibles</span>
            <div className="badges" role="group" aria-label="Accessoires disponibles">
              {ACCESSOIRES.map((a) => (
                <button type="button" key={a} className={`badge choix ${dispo.includes(a) ? 'actif' : ''}`} aria-pressed={dispo.includes(a)}
                  onClick={() => setDispo(dispo.includes(a) ? dispo.filter((x) => x !== a) : [...dispo, a])}>{a}</button>
              ))}
            </div>
            <p className="aide">
              {dispo.length === ACCESSOIRES.length ? 'Tout le matériel est disponible.'
                : dispo.length === 0 ? 'Aucun accessoire : seules les postures sans matériel sont proposées.'
                  : 'Seules les postures faisables avec ce matériel sont proposées.'}
            </p>
            <span className="etiquette">Éviter les répétitions</span>
            <div className="niveaux" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="group" aria-label="Éviter les postures des séances précédentes">
              {[[0, 'Non'], [1, 'Dernière'], [3, '3 dernières'], [5, '5 dernières']].map(([n, nom]) => (
                <button type="button" key={n} className={`niveau ${n === eviter ? 'actif' : ''}`} aria-pressed={n === eviter}
                  onClick={() => setEviter(n)}>{nom}</button>
              ))}
            </div>
            {eviter > 0 && <p className="aide">Les postures de vos séances enregistrées les plus récentes sont évitées autant que possible.</p>}
          </div>
        </div>
      </section>

      <div className="ressort" />

      <footer className="pied colonne">
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <button type="submit" className="composer" disabled={chargement}>
          <span>{chargement ? 'Composition…' : 'Composer'}</span>
          <small>{styles.length === 0 ? 'Tous styles' : styles.map((x) => COURT[x] || x).join(' + ')} · {duree}′{cible ? ` · ${nom(cible)}` : ''} →</small>
        </button>
      </footer>
    </form>
  );
}
