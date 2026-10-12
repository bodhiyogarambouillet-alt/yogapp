import { useEffect, useRef, useState } from 'react';
import { STYLES, DUREES, PAR_ID, nom } from '../bibliotheque.js';
import { Logo, Retour, Utilisateur } from './Icones.jsx';
import ChoixCible from './ChoixCible.jsx';
import { ACCESSOIRES } from '../accessoires.js';
import { useRetour } from '../natif.js';
import { listerSeances } from '../stockage.js';
import SelecteurSeances from './SelecteurSeances.jsx';

// Création d'une séance étape par étape : une question par écran.
// 0 accueil · 1 style · 2 durée · 3 niveau · 4 options (facultatif) · 5 récapitulatif

// Les 6 styles les plus courants en tuiles, les autres derrière « + n autres styles »
const PRINCIPAUX = ['Hatha', 'De Gasquet', 'Yin', 'Doux / seniors', 'Yoga du dos', 'Prénatal'];
const COURT = { 'Doux / seniors': 'Doux', 'Yoga du dos': 'Dos' };
const NIVEAUX = [
  ['Débutant', 'Postures simples, sans pic exigeant'],
  ['Intermédiaire', 'Postures de niveau 1 et 2'],
  ['Avancé', 'Tous niveaux, pic exigeant'],
];
const NB_ETAPES = 5; // étapes après l'accueil (pour la barre de progression)

const libelleStyles = (styles) => (styles.length === 0 ? 'Tous styles' : styles.map((x) => COURT[x] || x).join(' + '));

// Décor du parcours : le soleil du logo (arc au trait et rayons arrondis) qui se lève à l'horizon.
// Un seul décor pour l'accueil et les étapes : il glisse en douceur d'une position à l'autre et monte à chaque étape.
// Les rayons font tout le tour, tous les 34° comme dans le logo : on en voit 5 quand le soleil est bas,
// ceux du bas apparaissent quand il passe au-dessus de l'horizon.
const ANGLES_RAYONS = [0, 34, -34, 68, -68, 102, -102, 136, -136, 170, -170];
function FondSoleil({ etape }) {
  return (
    <div className={`fond-soleil ${etape === 0 ? 'accueil' : ''}`} style={{ '--etape': etape }} aria-hidden="true">
      <div className="fond-ciel">
        <div className="fond-astre">
          <div className="fond-astre-souffle">
            <svg viewBox="0 0 200 200">
              <circle className="fond-arc" cx="100" cy="100" r="58" />
              <g className="fond-rayons">
                {ANGLES_RAYONS.map((a, i) => (
                  <line key={a} className="fond-rayon" x1="100" y1="27" x2="100" y2="7" transform={`rotate(${a} 100 100)`} style={{ animationDelay: `${(i % 5) * 0.35}s` }} />
                ))}
              </g>
            </svg>
          </div>
        </div>
      </div>
      <div className="fond-sol" />
    </div>
  );
}

// Une option facultative repliable (étape 4)
function Option({ titre, valeur, ouvert, onBasculer, children }) {
  const zone = useRef(null);
  useEffect(() => { zone.current?.toggleAttribute('inert', !ouvert); }, [ouvert]);
  return (
    <div className={`option-ligne ${ouvert ? 'ouvert' : ''}`}>
      <button type="button" className="option-tete" aria-expanded={ouvert} onClick={onBasculer}>
        <span>{titre}</span>
        <span className="option-valeur">{valeur}<span className="option-fleche" aria-hidden="true">›</span></span>
      </button>
      <div ref={zone} className={`repli-options ${ouvert ? 'ouvert' : ''}`}>
        <div className="options">{children}</div>
      </div>
    </div>
  );
}

export default function Formulaire({ initial, erreur, compte, onGenerer, onMesSeances, onBibliotheque, onCompte }) {
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
  const [seancesEvitees, setSeancesEvitees] = useState(initial?.seancesEvitees || []); // séances choisies une à une
  const [mesSeances, setMesSeances] = useState(null); // chargées à l'ouverture de l'option
  const [selecteur, setSelecteur] = useState(false); // sélecteur plein écran des séances à éviter
  const [optionOuverte, setOptionOuverte] = useState(null);
  const [autreDuree, setAutreDuree] = useState(!DUREES.includes(initial?.duree || 45)); // durée personnalisée

  // Étape affichée et sens de la transition (avance / recul)
  const [etape, setEtape] = useState(erreur ? 5 : 0);
  const [sens, setSens] = useState('avance');
  const aller = (n) => {
    setSens(n >= etape ? 'avance' : 'recul');
    setEtape(n);
    setOptionOuverte(null);
    window.scrollTo(0, 0);
  };
  useEffect(() => { if (erreur) setEtape(5); }, [erreur]);
  // Bouton retour d'Android : étape précédente
  useRetour(etape > 0, () => aller(etape - 1), 1);

  // Postnatal en tête des autres styles, donc juste après Prénatal (dernier style principal)
  const autres = STYLES.filter((s) => !PRINCIPAUX.includes(s)).sort((a, b) => (b === 'Postnatal') - (a === 'Postnatal'));
  const visibles = tousStyles ? [...PRINCIPAUX, ...autres] : PRINCIPAUX;
  const basculerOption = (o) => setOptionOuverte(optionOuverte === o ? null : o);

  // Séances enregistrées, pour en exclure certaines de la génération
  useEffect(() => {
    if ((optionOuverte !== 'eviter' && !(etape === 4 && eviter)) || mesSeances) return;
    listerSeances().then(setMesSeances).catch(() => setMesSeances([]));
  }, [optionOuverte, mesSeances, etape, eviter]);
  const basculerSeance = (uid) => setSeancesEvitees((sel) => (sel.includes(uid) ? sel.filter((x) => x !== uid) : [...sel, uid]));
  const resumeEviter = seancesEvitees.length ? `${seancesEvitees.length} séance${seancesEvitees.length > 1 ? 's' : ''}` : 'Non';
  // Ancien réglage « n dernières séances » : converti en sélection explicite une fois les séances chargées
  useEffect(() => {
    if (!mesSeances || !eviter) return;
    setSeancesEvitees((sel) => [...new Set([...sel, ...mesSeances.slice(0, eviter).map((x) => x.uid)])]);
    setEviter(0);
  }, [mesSeances, eviter]);

  const composer = () => onGenerer({
    styles, duree, niveau, theme: theme.trim(), cibleId: cible?.id || null, eviterRepetition: eviter, seancesEvitees,
    accessoires: dispo.length === ACCESSOIRES.length ? null : dispo,
  });

  const resumeAccessoires = dispo.length === 0 ? 'Aucun' : dispo.length === ACCESSOIRES.length ? 'Tous' : `${dispo.length}`;
  const nbOptions = [cible, theme.trim(), dispo.length, eviter || seancesEvitees.length].filter(Boolean).length;

  // ---------- Contenu de chaque étape ----------
  let contenu;
  let pied;
  if (etape === 0) {
    contenu = (
      <>
        <div className="accueil-haut">
          <div className="marque"><span className="accent"><Logo /></span><span>Mes séances Yoga</span></div>
          {compte?.actif && (
            <button type="button" className="rond" aria-label={compte.email ? 'Compte' : 'Se connecter'} onClick={onCompte}><Utilisateur /></button>
          )}
        </div>
        <h1 className="etape-titre accueil-titre">Prépare<br />ton prochain cours</h1>
        <p className="etape-aide">Une séance sur mesure en quelques questions.</p>
        {initial && (
          <button type="button" className="carte-reprise" onClick={() => aller(5)}>
            <span className="carte-reprise-titre">Reprendre mes derniers choix</span>
            <span className="carte-reprise-detail">{libelleStyles(styles)} · {duree} min · {niveau}</span>
          </button>
        )}
      </>
    );
    pied = (
      <>
        <button type="button" className="composer" onClick={() => aller(1)}><span>Nouvelle séance</span><small>→</small></button>
        <div className="accueil-liens">
          <button type="button" className="secondaire" onClick={onMesSeances}>Mes séances</button>
          <button type="button" className="secondaire" onClick={onBibliotheque}>Postures</button>
        </div>
      </>
    );
  } else if (etape === 1) {
    contenu = (
      <>
        <h1 className="etape-titre">Quel style ?</h1>
        <p className="etape-aide">Un ou plusieurs. Aucun : la séance puise dans toutes les postures.</p>
        <div className="tuiles etape-tuiles" role="group" aria-label="Styles">
          {visibles.map((s) => (
            <button type="button" key={s} aria-pressed={styles.includes(s)}
              className={`tuile ${styles.includes(s) ? 'actif' : ''}`}
              onClick={() => setStyles(styles.includes(s) ? styles.filter((x) => x !== s) : [...styles, s])}>
              {COURT[s] || s}
            </button>
          ))}
        </div>
        <button type="button" className="lien" aria-expanded={tousStyles} onClick={() => setTousStyles(!tousStyles)}>
          {tousStyles ? 'Moins de styles' : `+ ${autres.length} autres styles`}
        </button>
      </>
    );
  } else if (etape === 2) {
    contenu = (
      <>
        <h1 className="etape-titre">Combien de temps ?</h1>
        <p className="etape-aide">Durée de la séance, en minutes.</p>
        <div className="durees etape-durees" role="group" aria-label="Durée">
          {DUREES.map((d) => (
            <button type="button" key={d} className={`duree ${!autreDuree && d === duree ? 'actif' : ''}`}
              aria-pressed={!autreDuree && d === duree} aria-label={`${d} minutes`} onClick={() => { setDuree(d); setAutreDuree(false); }}>{d}</button>
          ))}
        </div>
        <div className={`duree-perso ${autreDuree ? 'actif' : ''}`}>
          <button type="button" className={`badge choix ${autreDuree ? 'actif' : ''}`} aria-pressed={autreDuree}
            onClick={() => setAutreDuree(!autreDuree)}>Autre durée</button>
          {autreDuree && (
            <label className="duree-perso-champ">
              <input type="number" inputMode="numeric" min="10" max="180" step="5" value={duree} aria-label="Durée en minutes"
                onChange={(e) => setDuree(Number(e.target.value) || 0)}
                onBlur={() => setDuree(Math.min(180, Math.max(10, Math.round(duree / 5) * 5 || 45)))} />
              <span>min</span>
            </label>
          )}
        </div>
      </>
    );
  } else if (etape === 3) {
    contenu = (
      <>
        <h1 className="etape-titre">Pour quel niveau ?</h1>
        <p className="etape-aide">Le niveau du groupe.</p>
        <div className="choix-liste" role="group" aria-label="Niveau">
          {NIVEAUX.map(([n, aide]) => (
            <button type="button" key={n} className={`choix-ligne ${n === niveau ? 'actif' : ''}`} aria-pressed={n === niveau}
              onClick={() => setNiveau(n)}>
              <span className="choix-ligne-titre">{n}</span>
              <span className="choix-ligne-aide">{aide}</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (etape === 4) {
    contenu = (
      <>
        <h1 className="etape-titre">Des précisions ?</h1>
        <p className="etape-aide">Tout est facultatif : vous pouvez passer.</p>
        <div className="choix-liste">
          <Option titre="Posture cible" valeur={cible ? nom(cible) : 'Aucune'} ouvert={optionOuverte === 'cible'} onBasculer={() => basculerOption('cible')}>
            <ChoixCible cible={cible} onChange={setCible} styles={styles} niveau={niveau} />
          </Option>
          <Option titre="Accessoires" valeur={resumeAccessoires} ouvert={optionOuverte === 'acc'} onBasculer={() => basculerOption('acc')}>
            <div className="badges" role="group" aria-label="Accessoires disponibles">
              {ACCESSOIRES.map((a) => (
                <button type="button" key={a} className={`badge choix ${dispo.includes(a) ? 'actif' : ''}`} aria-pressed={dispo.includes(a)}
                  onClick={() => setDispo(dispo.includes(a) ? dispo.filter((x) => x !== a) : [...dispo, a])}>{a}</button>
              ))}
            </div>
            <p className="aide">
              {dispo.length === 0 ? 'Aucun accessoire : seules les postures sans matériel sont proposées.'
                : 'Seules les postures faisables avec ce matériel sont proposées.'}
            </p>
          </Option>
          <Option titre="Thème ou contraintes" valeur={theme.trim() ? 'Renseigné' : 'Aucun'} ouvert={optionOuverte === 'theme'} onBasculer={() => basculerOption('theme')}>
            <textarea id="theme" rows="3" maxLength={500} value={theme} onChange={(e) => setTheme(e.target.value)}
              placeholder="Ancrage, deux élèves aux lombaires fragiles…" aria-label="Thème ou contraintes" />
          </Option>
          <Option titre="Éviter les répétitions" valeur={resumeEviter} ouvert={optionOuverte === 'eviter'} onBasculer={() => basculerOption('eviter')}>
            <p className="aide option-aide">Les postures des séances choisies sont évitées autant que possible.</p>
            {seancesEvitees.length > 0 && (
              <div className="badges pastilles-exclues">
                {seancesEvitees.map((uid) => {
                  const se = mesSeances?.find((x) => x.uid === uid);
                  return (
                    <button type="button" key={uid} className="badge choix actif pastille-exclue" aria-label={`Retirer ${se?.titre || 'la séance'}`}
                      onClick={() => basculerSeance(uid)}>
                      <span>{se ? (se.titre || `${se.style} · ${se.duree} min`) : 'Séance'}</span><span aria-hidden="true">×</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button type="button" className="secondaire bouton-choisir-seances" onClick={() => setSelecteur(true)} disabled={!mesSeances?.length}>
              {mesSeances === null ? 'Chargement de vos séances…' : mesSeances.length ? (seancesEvitees.length ? 'Modifier la sélection' : 'Choisir des séances') : 'Aucune séance enregistrée'}
            </button>
          </Option>
        </div>
      </>
    );
  } else {
    const lignes = [
      ['Style', libelleStyles(styles), 1],
      ['Durée', `${duree} min`, 2],
      ['Niveau', niveau, 3],
      ['Options', nbOptions ? `${nbOptions} précision${nbOptions > 1 ? 's' : ''}` : 'Aucune', 4],
    ];
    contenu = (
      <>
        <h1 className="etape-titre">Votre séance</h1>
        <p className="etape-aide">Touchez une ligne pour la modifier.</p>
        <div className="choix-liste">
          {lignes.map(([titre, valeur, n]) => (
            <button type="button" key={titre} className="option-tete recap-ligne" onClick={() => aller(n)}>
              <span>{titre}</span>
              <span className="option-valeur">{valeur}<span className="option-fleche" aria-hidden="true">›</span></span>
            </button>
          ))}
        </div>
        {cible && <p className="etape-aide recap-cible">Objectif : {nom(cible)}</p>}
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
      </>
    );
  }

  if (etape >= 1 && etape <= 3) {
    pied = <button type="button" className="composer" onClick={() => aller(etape + 1)}><span>Suivant</span><small>→</small></button>;
  } else if (etape === 4) {
    pied = (
      <>
        <button type="button" className="composer" onClick={() => aller(5)}><span>Voir le récapitulatif</span><small>→</small></button>
        <button type="button" className="lien etape-passer" onClick={() => aller(5)}>Passer</button>
      </>
    );
  } else if (etape === 5) {
    pied = <button type="button" className="composer" onClick={composer}><span>Composer la séance</span><small>→</small></button>;
  }

  return (
    <div className="ecran etapes">
      <FondSoleil etape={etape} />
      {etape > 0 && (
        <header className="etape-haut">
          <button type="button" className="rond" aria-label="Étape précédente" onClick={() => aller(etape - 1)}><Retour /></button>
          <div className="etape-progression" role="progressbar" aria-valuemin={1} aria-valuemax={NB_ETAPES} aria-valuenow={etape}
            aria-label={`Étape ${etape} sur ${NB_ETAPES}`}>
            {Array.from({ length: NB_ETAPES }, (_, i) => <span key={i} className={i < etape ? 'fait' : ''} />)}
          </div>
        </header>
      )}
      <section key={etape} className={`etape-corps ${sens}`}>{contenu}</section>
      <div className="ressort" />
      <footer className="etape-pied">{pied}</footer>
      {selecteur && mesSeances && (
        <SelecteurSeances seances={mesSeances} choisies={seancesEvitees} onFermer={() => setSelecteur(false)}
          onValider={(liste) => { setSeancesEvitees(liste); setSelecteur(false); }} />
      )}
    </div>
  );
}
