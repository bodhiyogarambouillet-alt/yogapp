import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Picto from './Picto.jsx';
import { POSTURES, nom, nomSecondaire } from '../bibliotheque.js';
import { Retour } from './Icones.jsx';

// Bibliothèque des postures : recherche, filtres par famille et par niveau, liste groupée par famille.
// Toucher une posture ouvre sa fiche ; au retour, la recherche, les filtres et la position sont retrouvés.
const sansAccents = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const NIVEAUX = [[1, 'Niveau 1'], [2, 'Niveau 2'], [3, 'Niveau 3']];
let memoire = { recherche: '', famille: null, niveau: null, defilement: 0 };

export default function Bibliotheque({ onRetour, onOuvrirPosture, selection = null }) {
  const [recherche, setRecherche] = useState(memoire.recherche);
  const [famille, setFamille] = useState(memoire.famille);
  const [niveau, setNiveau] = useState(memoire.niveau);

  useLayoutEffect(() => { window.scrollTo(0, memoire.defilement); }, []);
  useEffect(() => { memoire = { ...memoire, recherche, famille, niveau }; }, [recherche, famille, niveau]);

  // Familles dans l'ordre d'une séance (respiration → relaxation), telles qu'elles apparaissent dans la bibliothèque
  const familles = useMemo(() => [...new Set(POSTURES.map((p) => p.famille))], []);
  const groupes = useMemo(() => {
    const q = sansAccents(recherche.trim());
    const trouvees = POSTURES.filter((p) => (!famille || p.famille === famille) && (!niveau || p.niveau === niveau)
      && (!q || sansAccents([p.fr, p.sanskrit, p.en, p.famille, ...(p.zones || [])].join(' ')).includes(q)));
    return familles
      .map((f) => [f, trouvees.filter((p) => p.famille === f).sort((a, b) => a.niveau - b.niveau || nom(a).localeCompare(nom(b), 'fr'))])
      .filter(([, liste]) => liste.length);
  }, [recherche, famille, niveau, familles]);
  const total = groupes.reduce((s, [, l]) => s + l.length, 0);

  const ouvrir = (p) => {
    memoire.defilement = window.scrollY;
    onOuvrirPosture(p);
  };
  const toutEffacer = () => { setRecherche(''); setFamille(null); setNiveau(null); };

  return (
    <div className="ecran bibliotheque">
      <header className="entete compact entete-onglet">
        <button type="button" className="rond" aria-label="Retour" onClick={() => { memoire.defilement = 0; onRetour(); }}><Retour /></button>
        <span className="sous">Bibliothèque</span>
        <span className="cale" />
      </header>

      <section className="bloc">
        <h1 className="titre-section">Postures</h1>
        <p className="sous">{total === POSTURES.length ? `${total} postures, chacune avec sa fiche.` : `${total} sur ${POSTURES.length} postures`}</p>
      </section>

      <div className="biblio-outils">
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
          placeholder="Nom, sanskrit, zone du corps…" aria-label="Rechercher une posture" />
        <div className="biblio-filtres" role="group" aria-label="Familles">
          <button type="button" className={`badge choix ${!famille ? 'actif' : ''}`} aria-pressed={!famille} onClick={() => setFamille(null)}>Toutes</button>
          {familles.map((f) => (
            <button type="button" key={f} className={`badge choix ${famille === f ? 'actif' : ''}`} aria-pressed={famille === f}
              onClick={() => setFamille(famille === f ? null : f)}>{f}</button>
          ))}
        </div>
        <div className="biblio-filtres" role="group" aria-label="Niveaux">
          {NIVEAUX.map(([n, libelle]) => (
            <button type="button" key={n} className={`badge choix ${niveau === n ? 'actif' : ''}`} aria-pressed={niveau === n}
              onClick={() => setNiveau(niveau === n ? null : n)}>{libelle}</button>
          ))}
        </div>
      </div>

      <section className="cartes biblio-liste">
        {total === 0 && (
          <div className="carte">
            <p>Aucune posture ne correspond.</p>
            <button type="button" className="lien" onClick={toutEffacer}>Effacer la recherche et les filtres</button>
          </div>
        )}
        {groupes.map(([f, liste]) => (
          <article key={f} className="phase biblio-groupe">
            <div className="phase-tete">
              <h2>{f}</h2>
              <span className="minutes">{liste.length}</span>
            </div>
            {liste.map((p) => (
              <div className={`ligne ${selection === p.id ? 'actif' : ''}`} key={p.id}>
                <button type="button" className="ligne-lien" aria-current={selection === p.id ? 'true' : undefined} onClick={() => ouvrir(p)}>
                  <Picto famille={p.famille} taille={38} />
                  <span className="ligne-texte">
                    <span className="ligne-nom">{nom(p)}</span>
                    <span className="ligne-infos">{[nomSecondaire(p), p.cotes ? 'deux côtés' : null, p.accessoires?.toLowerCase()].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={`biblio-niveau n${p.niveau}`} aria-label={`Niveau ${p.niveau}`}>{p.niveau}</span>
                </button>
              </div>
            ))}
          </article>
        ))}
      </section>
      <div style={{ height: 32 }} />
    </div>
  );
}
