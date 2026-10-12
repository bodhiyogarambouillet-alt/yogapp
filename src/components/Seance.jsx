import { useState } from 'react';
import { PAR_ID, bilanZones, alternatives, dureeParDefaut, nom, nomSecondaire, rechercherPostures } from '../bibliotheque.js';
import { stylesDe } from '../styles-seance.js';
import Picto from './Picto.jsx';
import { dateDe } from '../dates.js';
import Live from './Live.jsx';
import { useRetour } from '../natif.js';
import { Retour, Remplacer, Attention, Valide, Points, Exporter, Etincelle, Fermer, Lecture } from './Icones.jsx';
import { exporterSeance } from '../export.js';

// Durées plus compactes dans la liste (le détail reste dans la fiche)
const court = (d) => (d || '').replace(/respirations?/i, 'resp.').replace(/droite \+ gauche/i, 'D + G');

const ROLES = { cible: 'Posture cible', preparation: 'Préparation', contre: 'Contre-posture' };

// Ajout d'une posture dans une phase (mode édition)
function AjoutPosture({ seance, onAjouter, onFermer }) {
  const [texte, setTexte] = useState('');
  const resultats = rechercherPostures(texte, stylesDe(seance), 8, true);
  return (
    <div className="ajout-posture">
      <input type="search" autoFocus autoComplete="off" value={texte} onChange={(e) => setTexte(e.target.value)}
        placeholder="Rechercher une posture…" aria-label="Rechercher une posture à ajouter" />
      {resultats.length > 0 && (
        <ul className="suggestions">
          {resultats.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onAjouter(p)}>
                <Picto famille={p.famille} taille={36} />
                <span className="ligne-texte">
                  <span className="ligne-nom">{nom(p)}</span>
                  <span className="ligne-infos">{[nomSecondaire(p), `niveau ${p.niveau}`].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {texte.trim().length >= 2 && resultats.length === 0 && <p className="aide">Aucune posture trouvée.</p>}
      <button type="button" className="lien" onClick={onFermer}>Annuler</button>
    </div>
  );
}

export default function Seance({ seance, onChange, onRetour, onRegenerer, onEnregistrer, onOuvrirPosture, enregistree, chargement }) {
  const [menu, setMenu] = useState(false);
  const [remplacement, setRemplacement] = useState(false);
  const [live, setLive] = useState(false); // déroulé en direct, avec minuteur
  const [edition, setEdition] = useState(false); // modifier la séance : ordre, durées, notes, ajouts, suppressions
  const [ajoutPhase, setAjoutPhase] = useState(null); // index de la phase où l'on ajoute une posture
  const [exportOuvert, setExportOuvert] = useState(false); // choix du format d'export
  const [exportEnCours, setExportEnCours] = useState(null); // format en cours de préparation

  const nbPostures = seance.phases.reduce((s, ph) => s + ph.items.length, 0);
  const total = seance.phases.reduce((s, ph) => s + ph.minutes, 0);
  const cible = seance.cibleId ? PAR_ID.get(seance.cibleId) : null;
  const bilan = bilanZones(seance);
  // Posture mise en avant dans l'arche : la cible, sinon la dernière posture du pic
  const pic = seance.phases.find((ph) => ph.phase === 'Pic');
  const vedette = cible || pic?.items.at(-1)?.posture || seance.phases.flatMap((ph) => ph.items).at(0)?.posture;
  // (pas d'article devant le nom : « le Roue » serait faux, d'où « Objectif » en surtitre)
  const titre = cible ? nom(cible) : seance.titre || seance.style;

  const remplacer = (iPhase, iItem) => {
    const item = seance.phases[iPhase].items[iItem];
    const alts = alternatives(item.posture, seance);
    if (alts.length === 0) return;
    const suivante = alts[Math.floor(Math.random() * Math.min(alts.length, 6))];
    const phases = seance.phases.map((ph, i) => i !== iPhase ? ph : {
      ...ph,
      items: ph.items.map((it, j) => j !== iItem ? it : { id: suivante.id, posture: suivante, duree: dureeParDefaut(suivante), role: it.role === 'cible' ? undefined : it.role }),
    });
    onChange({ ...seance, phases });
  };

  const action = (fn) => () => { setMenu(false); fn(); };

  // Retour d'Android : ferme d'abord le menu, l'ajout de posture, puis les modes édition / remplacement
  useRetour(!live && (menu || edition || remplacement || exportOuvert), () => {
    if (exportOuvert) setExportOuvert(false);
    else if (menu) setMenu(false);
    else if (ajoutPhase !== null) setAjoutPhase(null);
    else { setEdition(false); setRemplacement(false); }
  }, 1);

  // ---------- Édition ----------
  const majPhase = (iPhase, fn) => onChange({ ...seance, phases: seance.phases.map((ph, i) => (i === iPhase ? fn(ph) : ph)) });
  const majItem = (iPhase, iItem, champs) =>
    majPhase(iPhase, (ph) => ({ ...ph, items: ph.items.map((it, j) => (j === iItem ? { ...it, ...champs } : it)) }));
  const supprimerItem = (iPhase, iItem) => majPhase(iPhase, (ph) => ({ ...ph, items: ph.items.filter((_, j) => j !== iItem) }));
  // Déplacer d'un cran ; en bout de phase, la posture passe dans la phase voisine
  const deplacer = (iPhase, iItem, sens) => {
    const phases = seance.phases.map((ph) => ({ ...ph, items: [...ph.items] }));
    const items = phases[iPhase].items;
    const cibleIndex = iItem + sens;
    if (cibleIndex >= 0 && cibleIndex < items.length) {
      [items[iItem], items[cibleIndex]] = [items[cibleIndex], items[iItem]];
    } else {
      const voisine = phases[iPhase + sens];
      if (!voisine) return;
      const [it] = items.splice(iItem, 1);
      if (sens < 0) voisine.items.push(it); else voisine.items.unshift(it);
    }
    onChange({ ...seance, phases });
  };
  const ajouter = (iPhase, p) => {
    majPhase(iPhase, (ph) => ({ ...ph, items: [...ph.items, { id: p.id, posture: p, duree: dureeParDefaut(p) }] }));
    setAjoutPhase(null);
  };
  const changerMinutes = (iPhase, valeur) => majPhase(iPhase, (ph) => ({ ...ph, minutes: Math.max(0, Math.min(180, Number(valeur) || 0)) }));

  if (live) {
    return <Live seance={seance} onQuitter={() => { setLive(false); window.scrollTo(0, 0); }} />;
  }

  return (
    <div className="ecran">
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Retour au formulaire" onClick={onRetour}><Retour /></button>
        <span className="sous">{seance.style} · {seance.niveau}</span>
        <button type="button" className="rond" aria-label="Plus d'actions" aria-expanded={menu} onClick={() => setMenu(!menu)}><Points /></button>
      </header>

      {menu && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={action(() => { setEdition(!edition); setRemplacement(false); setAjoutPhase(null); })}><Points /> {edition ? 'Terminer les modifications' : 'Modifier la séance'}</button>
          <button type="button" role="menuitem" onClick={action(() => { setRemplacement(!remplacement); setEdition(false); })}><Remplacer /> {remplacement ? 'Terminer les remplacements' : 'Remplacer des postures'}</button>
          <button type="button" role="menuitem" onClick={action(() => setExportOuvert(true))}><Exporter /> Exporter</button>
          <button type="button" role="menuitem" onClick={action(onRegenerer)} disabled={chargement}><Etincelle /> Autre version</button>
        </div>
      )}

      {exportOuvert && (
        <div className="voile" onClick={() => !exportEnCours && setExportOuvert(false)}>
          <div className="feuille" role="dialog" aria-label="Exporter la séance" onClick={(e) => e.stopPropagation()}>
            <h2>Exporter la séance</h2>
            {[['texte', 'Texte', 'À coller dans un message ou une note'], ['pdf', 'PDF', 'À imprimer ou à envoyer'], ['image', 'Image', 'Une image à partager']].map(([f, titre, aide]) => (
              <button type="button" key={f} className="choix-export" disabled={Boolean(exportEnCours)}
                onClick={async () => {
                  setExportEnCours(f);
                  try {
                    await exporterSeance(seance, f);
                    setExportOuvert(false);
                  } catch (e) {
                    window.alert(`Export impossible : ${e.message}`);
                  } finally {
                    setExportEnCours(null);
                  }
                }}>
                <strong>{exportEnCours === f ? 'Préparation…' : titre}</strong>
                <span>{aide}</span>
              </button>
            ))}
            <button type="button" className="lien" onClick={() => setExportOuvert(false)} disabled={Boolean(exportEnCours)}>Annuler</button>
          </div>
        </div>
      )}

      <section className="heros">
        {vedette && (
          <div className="arche moyenne"><Picto famille={vedette.famille} taille={80} /></div>
        )}
        <div>
          <div className="chiffre"><strong>{total}′</strong><span>{nbPostures} postures</span></div>
          {cible && <p className="surtitre">Objectif</p>}
          <h1>{titre}</h1>
        </div>
      </section>

      {seance.intention && <p className="intention seance-intention">{seance.intention}</p>}

      <button type="button" className="composer lancer" onClick={() => { setLive(true); window.scrollTo(0, 0); }}>
        <span>Lancer la séance</span>
        <Lecture />
      </button>

      <label className="date-seance">
        <span>Date de la séance</span>
        <input type="date" value={dateDe(seance) || ''} onChange={(e) => onChange({ ...seance, dateSeance: e.target.value || null })} />
      </label>

      {bilan && bilan.manquantes.length === 0 && (
        <p className="bilan"><Valide /> {bilan.couvertes.join(', ')} : préparé{bilan.couvertes.length > 1 ? 's' : ''}</p>
      )}
      {bilan && bilan.manquantes.length > 0 && (
        <p className="bilan manque"><Attention /> Pas encore préparé : {bilan.manquantes.join(', ')}. Remplacez une posture ou demandez une autre version.</p>
      )}
      {seance.avertissement && <p className="avertissement"><Attention />{seance.avertissement}</p>}

      {edition && (
        <div className="mode-remplacement mode-edition">
          <label className="edition-titre">
            <span>Titre</span>
            <input type="text" value={seance.titre || ''} onChange={(e) => onChange({ ...seance, titre: e.target.value })} />
          </label>
          <button type="button" className="principal" onClick={() => { setEdition(false); setAjoutPhase(null); }}>Terminer</button>
        </div>
      )}

      {remplacement && (
        <div className="mode-remplacement">
          <span>Touchez ⇄ pour remplacer une posture.</span>
          <button type="button" className="rond nu" aria-label="Terminer les remplacements" onClick={() => setRemplacement(false)}><Fermer /></button>
        </div>
      )}

      <section className="phases">
        {seance.phases.map((ph, i) => (
          <article key={ph.phase} className={`phase ${ph.phase === 'Pic' && ph.items.length ? 'pic' : ''}`}>
            <div className="phase-tete">
              <h2>{ph.phase}</h2>
              {edition ? (
                <label className="minutes edition-minutes">
                  <input type="number" inputMode="numeric" min="0" max="180" value={ph.minutes} aria-label={`Minutes de la phase ${ph.phase}`}
                    onChange={(e) => changerMinutes(i, e.target.value)} />′
                </label>
              ) : <span className="minutes">{ph.minutes}′</span>}
            </div>
            {ph.items.length === 0 && <p className="vide">Aucune posture proposée pour cette phase.</p>}
            {ph.items.map((it, j) => (
              <div className={`ligne ${it.role === 'cible' ? 'ligne-cible' : ''}`} key={`${it.id}-${j}`}>
                <button type="button" className="ligne-lien" onClick={() => !edition && onOuvrirPosture(it.posture)}>
                  <Picto famille={it.posture.famille} taille={38} />
                  <span className="ligne-texte">
                    {it.role && it.role !== 'cible' && <span className="role">{ROLES[it.role]}</span>}
                    <span className="ligne-nom">{nom(it.posture)}</span>
                    {it.note && <span className="ligne-note">{it.note}</span>}
                  </span>
                  <span className="duree-ligne">{court(it.duree)}</span>
                </button>
                {remplacement && it.role !== 'cible' && (
                  <button type="button" className="rond nu" aria-label={`Remplacer ${nom(it.posture)}`} onClick={() => remplacer(i, j)}><Remplacer /></button>
                )}
                {edition && (
                  <div className="edition-ligne">
                    <input type="text" className="edition-duree" value={it.duree || ''} aria-label={`Durée de ${nom(it.posture)}`}
                      placeholder="Durée" onChange={(e) => majItem(i, j, { duree: e.target.value })} />
                    <input type="text" className="edition-note" value={it.note || ''} aria-label={`Consigne pour ${nom(it.posture)}`}
                      placeholder="Consigne (facultatif)" onChange={(e) => majItem(i, j, { note: e.target.value || undefined })} />
                    <div className="edition-boutons">
                      <button type="button" className="rond nu" aria-label="Monter" disabled={i === 0 && j === 0} onClick={() => deplacer(i, j, -1)}>↑</button>
                      <button type="button" className="rond nu" aria-label="Descendre" disabled={i === seance.phases.length - 1 && j === ph.items.length - 1} onClick={() => deplacer(i, j, 1)}>↓</button>
                      <button type="button" className="rond nu" aria-label={`Retirer ${nom(it.posture)}`} onClick={() => supprimerItem(i, j)}><Fermer /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {edition && (ajoutPhase === i
              ? <AjoutPosture seance={seance} onAjouter={(p) => ajouter(i, p)} onFermer={() => setAjoutPhase(null)} />
              : <button type="button" className="lien ajouter" onClick={() => setAjoutPhase(i)}>+ Ajouter une posture</button>)}
          </article>
        ))}
      </section>

      <div className="ressort" />

      <footer className="pied deux">
        <button type="button" className="secondaire" style={{ borderColor: 'var(--trait)' }} onClick={onRegenerer} disabled={chargement}>
          {chargement ? 'Composition…' : 'Autre version'}
        </button>
        <button type="button" className={enregistree ? 'secondaire' : 'principal'} onClick={onEnregistrer}>{enregistree ? 'Enregistrée ✓' : 'Enregistrer'}</button>
      </footer>
    </div>
  );
}
