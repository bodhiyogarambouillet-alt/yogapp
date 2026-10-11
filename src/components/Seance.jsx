import { useState } from 'react';
import { PAR_ID, bilanZones, alternatives, dureeParDefaut, nom } from '../bibliotheque.js';
import Picto from './Picto.jsx';
import { Retour, Remplacer, Attention, Valide, Points, Imprimer, Etincelle, Fermer } from './Icones.jsx';

// Durées plus compactes dans la liste (le détail reste dans la fiche)
const court = (d) => (d || '').replace(/respirations?/i, 'resp.').replace(/droite \+ gauche/i, 'D + G');

const ROLES = { cible: 'Posture cible', preparation: 'Préparation', contre: 'Contre-posture' };

export default function Seance({ seance, onChange, onRetour, onRegenerer, onEnregistrer, onOuvrirPosture, enregistree, chargement }) {
  const [menu, setMenu] = useState(false);
  const [remplacement, setRemplacement] = useState(false);

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

  return (
    <div className="ecran">
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Retour au formulaire" onClick={onRetour}><Retour /></button>
        <span className="sous">{seance.style} · {seance.niveau}</span>
        <button type="button" className="rond" aria-label="Plus d'actions" aria-expanded={menu} onClick={() => setMenu(!menu)}><Points /></button>
      </header>

      {menu && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={action(() => setRemplacement(!remplacement))}><Remplacer /> {remplacement ? 'Terminer les remplacements' : 'Remplacer des postures'}</button>
          <button type="button" role="menuitem" onClick={action(() => window.print())}><Imprimer /> Imprimer</button>
          <button type="button" role="menuitem" onClick={action(onRegenerer)} disabled={chargement}><Etincelle /> Autre version</button>
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

      {bilan && bilan.manquantes.length === 0 && (
        <p className="bilan"><Valide /> {bilan.couvertes.join(', ')} : préparé{bilan.couvertes.length > 1 ? 's' : ''}</p>
      )}
      {bilan && bilan.manquantes.length > 0 && (
        <p className="bilan manque"><Attention /> Pas encore préparé : {bilan.manquantes.join(', ')}. Remplacez une posture ou demandez une autre version.</p>
      )}
      {seance.avertissement && <p className="avertissement"><Attention />{seance.avertissement}</p>}
      {seance.intention && <p className="intention" style={{ margin: '12px 24px 0' }}>{seance.intention}</p>}

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
              <span className="minutes">{ph.minutes}′</span>
            </div>
            {ph.items.length === 0 && <p className="vide">Aucune posture proposée pour cette phase.</p>}
            {ph.items.map((it, j) => (
              <div className={`ligne ${it.role === 'cible' ? 'ligne-cible' : ''}`} key={`${it.id}-${j}`}>
                <button type="button" className="ligne-lien" onClick={() => onOuvrirPosture(it.posture)}>
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
              </div>
            ))}
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
