import { useEffect, useRef, useState } from 'react';
import { useRetour } from '../natif.js';

// Boîtes de dialogue aux couleurs de l'appli, à la place de window.confirm / window.alert.
// confirmer({ titre, message, ok, annuler, danger }) → Promise<boolean> ; alerter({ titre, message }) → Promise<void>.
// Le composant <Dialogues /> est monté une fois dans l'appli.

let afficher = null;
const enAttente = [];

function ouvrir(options) {
  return new Promise((resoudre) => {
    const d = { ...options, resoudre };
    if (afficher) afficher(d); else enAttente.push(d);
  });
}

export const confirmer = (options) => ouvrir({ ok: 'Confirmer', annuler: 'Annuler', ...options });
export const alerter = (options) => ouvrir({ ok: 'OK', ...(typeof options === 'string' ? { message: options } : options), annuler: null });

export function Dialogues() {
  const [file, setFile] = useState([]);
  const bouton = useRef(null);
  useEffect(() => {
    afficher = (d) => setFile((f) => [...f, d]);
    if (enAttente.length) setFile((f) => [...f, ...enAttente.splice(0)]);
    return () => { afficher = null; };
  }, []);

  const d = file[0];
  const fermer = (reponse) => {
    d.resoudre(d.annuler === null ? undefined : reponse);
    setFile((f) => f.slice(1));
  };
  useRetour(Boolean(d), () => fermer(false), 9);
  useEffect(() => { if (d) bouton.current?.focus(); }, [d]);
  useEffect(() => {
    if (!d) return undefined;
    const touche = (e) => { if (e.key === 'Escape') fermer(false); };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  if (!d) return null;
  return (
    <div className="voile voile-dialogue" onClick={() => fermer(false)}>
      <div className="dialogue" role="alertdialog" aria-modal="true" aria-labelledby="dialogue-titre" aria-describedby="dialogue-message"
        onClick={(e) => e.stopPropagation()}>
        <svg className="dialogue-soleil" viewBox="0 0 28 28" aria-hidden="true">
          <path d="M4 20a10 10 0 0 1 20 0" /><path d="M2 24h24" /><path d="M14 7.8V5.8" /><path d="M20.82 9.89L21.94 8.23" />
          <path d="M7.18 9.89L6.06 8.23" /><path d="M25.31 15.43L27.17 14.68" /><path d="M2.69 15.43L.83 14.68" />
        </svg>
        <h2 id="dialogue-titre">{d.titre}</h2>
        {d.message && <p id="dialogue-message">{d.message}</p>}
        <div className={`dialogue-boutons ${d.annuler ? 'deux' : ''}`}>
          {d.annuler && <button type="button" className="secondaire" onClick={() => fermer(false)}>{d.annuler}</button>}
          <button type="button" ref={bouton} className={`principal ${d.danger ? 'danger' : ''}`} onClick={() => fermer(true)}>{d.ok}</button>
        </div>
      </div>
    </div>
  );
}
