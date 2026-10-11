import { useRef, useState } from 'react';
import { listerSeances, supprimerSeance, fichesValidees, importerFiches } from '../stockage.js';
import { Retour, Poubelle } from './Icones.jsx';
import { PAR_ID } from '../bibliotheque.js';
import FICHES_REFERENCE from '../data/fiches.json';

// Fichier d'export : lisible et réimportable (sur un autre appareil, ou dans la bibliothèque via npm run import-fiches)
function telecharger(fiches) {
  const contenu = {
    format: 'yoga-app/fiches',
    version: 1,
    exporteLe: new Date().toISOString(),
    fiches: Object.fromEntries(Object.entries(fiches).map(([id, f]) => {
      const { mode: _m, modele: _mo, ...reste } = f;
      return [id, { posture: PAR_ID.get(id)?.fr || id, ...reste, id }];
    })),
  };
  const blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fiches-validees-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MesSeances({ onRetour, onOuvrir }) {
  const [liste, setListe] = useState(listerSeances);
  const [fiches, setFiches] = useState(fichesValidees);
  const [message, setMessage] = useState(null);
  const entreeFichier = useRef(null);

  const supprimer = (uid) => {
    supprimerSeance(uid);
    setListe(listerSeances());
  };

  const importer = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    try {
      const donnees = JSON.parse(await fichier.text());
      const brutes = donnees.fiches || donnees;
      const connues = Object.fromEntries(Object.entries(brutes).filter(([id]) => PAR_ID.has(id)));
      const n = importerFiches(connues);
      const ignorees = Object.keys(brutes).length - Object.keys(connues).length;
      setFiches(fichesValidees());
      setMessage(`${n} fiche(s) importée(s)${ignorees ? `, ${ignorees} ignorée(s) (postures inconnues)` : ''}.`);
    } catch {
      setMessage('Fichier illisible : choisissez un export « fiches-validees-….json ».');
    }
  };

  const ids = Object.keys(fiches).sort((a, b) => (PAR_ID.get(a)?.fr || a).localeCompare(PAR_ID.get(b)?.fr || b, 'fr'));
  const nbReference = Object.keys(FICHES_REFERENCE).length;

  return (
    <div className="ecran">
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Retour" onClick={onRetour}><Retour /></button>
        <span className="sous">Mes séances et fiches</span>
        <span className="cale" />
      </header>

      <section className="bloc">
        <h1>Mes séances</h1>
        <p className="sous">Enregistrées sur cet appareil.</p>
      </section>
      <section className="cartes">
        {liste.length === 0 && <div className="carte"><p>Aucune séance enregistrée pour l'instant.</p></div>}
        {liste.map((s) => (
          <div className="carte ligne-seance" key={s.uid}>
            <button type="button" className="ligne-lien" onClick={() => onOuvrir(s)}>
              <span className="ligne-texte">
                <span className="ligne-nom">{s.style} · {s.duree} min · {s.niveau}</span>
                {s.cibleId && PAR_ID.get(s.cibleId) && <span className="ligne-infos">Objectif : {PAR_ID.get(s.cibleId).fr}</span>}
                <span className="ligne-infos">{s.titre || s.theme || ''}</span>
                <span className="ligne-infos">{new Date(s.enregistreeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </span>
            </button>
            <button type="button" className="rond nu" aria-label="Supprimer la séance" onClick={() => supprimer(s.uid)}><Poubelle /></button>
          </div>
        ))}
      </section>

      <section className="bloc">
        <h1 className="titre-section">Fiches validées</h1>
        <p className="sous">
          {ids.length} fiche(s) validée(s) sur cet appareil
          {nbReference > 0 && ` · ${nbReference} fiche(s) de référence dans la bibliothèque`}.
        </p>
      </section>
      <section className="cartes">
        <div className="carte">
          <div className="actions-export">
            <button type="button" className="secondaire" disabled={ids.length === 0} onClick={() => telecharger(fiches)}>Exporter</button>
            <button type="button" className="secondaire" onClick={() => entreeFichier.current?.click()}>Importer</button>
            <input ref={entreeFichier} type="file" accept="application/json,.json" hidden onChange={importer} />
          </div>
          {message && <p className="aide" role="status">{message}</p>}
          <p className="aide">
            Exporter crée un fichier à garder en sauvegarde, à importer sur un autre appareil, ou à intégrer à la bibliothèque
            de l'appli pour que ces fiches deviennent la référence partout.
          </p>
        </div>
        {ids.length > 0 && (
          <div className="carte liste-fiches">
            {ids.map((id) => <span key={id} className="badge">{PAR_ID.get(id)?.fr || id}</span>)}
          </div>
        )}
      </section>
    </div>
  );
}
