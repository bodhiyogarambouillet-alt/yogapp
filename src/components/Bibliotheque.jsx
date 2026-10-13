import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Picto from './Picto.jsx';
import { POSTURES, nom, nomSecondaire } from '../bibliotheque.js';
import { Retour } from './Icones.jsx';
import { useRetour } from '../natif.js';

// Bibliothèque des postures, par famille d'abord : tuiles des familles (mobile) ou barre latérale (ordinateur),
// puis la liste de la famille choisie, avec recherche et filtre de niveau. Toucher une posture ouvre sa fiche ;
// au retour, la famille, la recherche, les filtres et la position sont retrouvés.
const sansAccents = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const NIVEAUX = [[1, 'Niveau 1'], [2, 'Niveau 2'], [3, 'Niveau 3']];
let memoire = { recherche: '', famille: null, niveau: null, defilement: 0 };

function Ligne({ p, actif, onOuvrir, variante = false }) {
  return (
    <div className={`ligne ${actif ? 'actif' : ''} ${variante ? 'biblio-variante' : ''}`}>
      <button type="button" className="ligne-lien" aria-current={actif ? 'true' : undefined} onClick={() => onOuvrir(p)}>
        <Picto famille={p.famille} taille={variante ? 30 : 38} />
        <span className="ligne-texte">
          <span className="ligne-nom">{variante ? nomSecondaire(p) || nom(p) : nom(p)}</span>
          <span className="ligne-infos">{[variante ? null : nomSecondaire(p), p.cotes ? 'deux côtés' : null, p.accessoires?.toLowerCase()].filter(Boolean).join(' · ')}</span>
        </span>
        <span className={`biblio-niveau n${p.niveau}`} aria-label={`Niveau ${p.niveau}`}>{p.niveau}</span>
      </button>
    </div>
  );
}

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

  // Variantes regroupées sous leur posture mère (sauf pendant une recherche ou un filtre de niveau : liste à plat)
  const regroupe = !recherche.trim() && !niveau;
  const variantesDe = useMemo(() => {
    const m = new Map();
    POSTURES.forEach((p) => { if (p.variante_de) m.set(p.variante_de, [...(m.get(p.variante_de) || []), p]); });
    m.forEach((l) => l.sort((a, b) => a.niveau - b.niveau || nom(a).localeCompare(nom(b), 'fr')));
    return m;
  }, []);
  const parId = useMemo(() => new Map(POSTURES.map((p) => [p.id, p])), []);
  // Une variante reste seule dans sa famille si sa posture mère est rangée dans une autre famille
  const sousMere = (p, f) => regroupe && p.variante_de && parId.get(p.variante_de)?.famille === f;
  const [ouvertes, setOuvertes] = useState(() => new Set(memoire.ouvertes || []));
  useEffect(() => { memoire.ouvertes = [...ouvertes]; }, [ouvertes]);
  const basculer = (id) => setOuvertes((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const ouvrir = (p) => {
    memoire.defilement = window.scrollY;
    onOuvrirPosture(p);
  };
  const toutEffacer = () => { setRecherche(''); setFamille(null); setNiveau(null); };
  const choisirFamille = (f) => { setFamille(f); window.scrollTo(0, 0); };
  const effectifs = useMemo(() => Object.fromEntries(familles.map((f) => [f, POSTURES.filter((p) => p.famille === f).length])), [familles]);
  // Accueil (mobile) : tuiles des familles tant qu'aucune famille, recherche ou niveau n'est choisi
  const accueil = !famille && !recherche.trim() && !niveau;
  // Retour d'Android depuis une famille : revenir aux tuiles
  useRetour(Boolean(famille), () => choisirFamille(null), 1);

  return (
    <div className={`ecran bibliotheque ${accueil ? 'accueil' : ''} ${famille ? 'en-famille' : ''}`}>
      <header className="entete compact entete-onglet">
        <button type="button" className="rond" aria-label="Retour" onClick={() => { memoire.defilement = 0; if (famille) choisirFamille(null); else onRetour(); }}><Retour /></button>
        <span className="sous">{famille || 'Bibliothèque'}</span>
        <span className="cale" />
      </header>

      <section className="bloc">
        <h1 className="titre-section">{famille || 'Postures'}</h1>
        <p className="sous">{(() => {
          const max = famille ? effectifs[famille] : POSTURES.length;
          if (total < max) return `${total} sur ${max} postures`;
          return famille ? `${max} postures` : `${max} postures, chacune avec sa fiche.`;
        })()}</p>
      </section>

      <div className="biblio-corps">
        {/* Ordinateur : familles dans une barre latérale */}
        <nav className="biblio-familles" aria-label="Familles">
          <button type="button" className={`biblio-famille ${!famille ? 'actif' : ''}`} aria-pressed={!famille} onClick={() => choisirFamille(null)}>
            <span>Toutes</span><span>{POSTURES.length}</span>
          </button>
          {familles.map((f) => (
            <button type="button" key={f} className={`biblio-famille ${famille === f ? 'actif' : ''}`} aria-pressed={famille === f} onClick={() => choisirFamille(f)}>
              <span>{f}</span><span>{effectifs[f]}</span>
            </button>
          ))}
        </nav>

        <div className="biblio-principal">
          {famille && <button type="button" className="lien biblio-retour" onClick={() => choisirFamille(null)}>← Toutes les familles</button>}
          <div className="biblio-outils">
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder={famille ? `Rechercher dans ${famille}…` : 'Nom, sanskrit, zone du corps…'} aria-label="Rechercher une posture" />
            <div className="biblio-filtres" role="group" aria-label="Niveaux">
              {NIVEAUX.map(([n, libelle]) => (
                <button type="button" key={n} className={`badge choix ${niveau === n ? 'actif' : ''}`} aria-pressed={niveau === n}
                  onClick={() => setNiveau(niveau === n ? null : n)}>{libelle}</button>
              ))}
            </div>
          </div>

          {/* Mobile : tuiles des familles */}
          {accueil && (
            <div className="biblio-tuiles">
              {familles.map((f) => (
                <button type="button" key={f} className="biblio-tuile" onClick={() => choisirFamille(f)}>
                  <Picto famille={f} taille={52} />
                  <span className="biblio-tuile-nom">{f}</span>
                  <span className="biblio-tuile-nombre">{effectifs[f]} postures</span>
                </button>
              ))}
            </div>
          )}

          <section className="cartes biblio-liste">
            {total === 0 && (
              <div className="carte">
                <p>Aucune posture ne correspond.</p>
                <button type="button" className="lien" onClick={toutEffacer}>Effacer la recherche et les filtres</button>
              </div>
            )}
            {groupes.map(([f, liste]) => (
              <article key={f} className="phase biblio-groupe">
                {!famille && (
                  <div className="phase-tete">
                    <h2>{f}</h2>
                    <span className="minutes">{liste.length}</span>
                  </div>
                )}
                <div className="biblio-items">
                  {liste.filter((p) => !sousMere(p, f)).map((p) => {
                    const vars = regroupe ? variantesDe.get(p.id) || [] : [];
                    const ouverte = ouvertes.has(p.id);
                    return (
                      <div className="biblio-bloc" key={p.id}>
                        <Ligne p={p} actif={selection === p.id} onOuvrir={ouvrir} />
                        {vars.length > 0 && (
                          <button type="button" className="biblio-variantes" aria-expanded={ouverte} onClick={() => basculer(p.id)}>
                            {ouverte ? 'Masquer les variantes' : `+ ${vars.length} variante${vars.length > 1 ? 's' : ''}`}
                          </button>
                        )}
                        {ouverte && vars.map((v) => <Ligne key={v.id} p={v} actif={selection === v.id} onOuvrir={ouvrir} variante />)}
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </section>
        </div>
      </div>
      <div style={{ height: 32 }} />
    </div>
  );
}
