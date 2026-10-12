import { useCallback, useEffect, useState } from 'react';
import { listerSeances, supprimerSeance, enregistrerSeance } from '../stockage.js';
import { dateDe, dateLisible } from '../dates.js';
import { Retour, Poubelle } from './Icones.jsx';
import { PAR_ID, nom } from '../bibliotheque.js';

export default function MesSeances({ compte, onRetour, onOuvrir }) {
  const [liste, setListe] = useState([]);
  const [message, setMessage] = useState(null);

  const connecte = compte?.actif && compte.email;

  const recharger = useCallback(async () => {
    try {
      setListe(await listerSeances());
    } catch (e) {
      setMessage(`Lecture impossible : ${e.message}`);
    }
  }, []);

  useEffect(() => { recharger(); }, [recharger, compte?.email]);

  const supprimer = async (uid) => {
    try {
      await supprimerSeance(uid);
      recharger();
    } catch (e) {
      setMessage(`Suppression impossible : ${e.message}`);
    }
  };

  const changerDate = async (s, dateSeance) => {
    if (!dateSeance) return;
    try {
      await enregistrerSeance({ ...s, dateSeance });
      recharger();
    } catch (e) {
      setMessage(`Modification impossible : ${e.message}`);
    }
  };

  return (
    <div className="ecran">
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Retour" onClick={onRetour}><Retour /></button>
        <span className="sous">Mes séances</span>
        <span className="cale" />
      </header>

      <section className="bloc">
        <h1 className="titre-section">Mes séances</h1>
        <p className="sous">{connecte ? 'Sur tous vos appareils.' : 'Enregistrées sur cet appareil.'}</p>
      </section>
      <section className="cartes liste-seances">
        {liste.length === 0 && <div className="carte"><p>Aucune séance enregistrée pour l'instant.</p></div>}
        {liste.map((s) => (
          <div className="carte ligne-seance" key={s.uid}>
            <button type="button" className="ligne-lien" onClick={() => onOuvrir(s)}>
              <span className="ligne-texte">
                <span className="ligne-nom">{s.style} · {s.duree} min · {s.niveau}</span>
                {s.cibleId && PAR_ID.get(s.cibleId) && <span className="ligne-infos">Objectif : {nom(PAR_ID.get(s.cibleId))}</span>}
                <span className="ligne-infos">{s.titre || s.theme || ''}</span>
              </span>
            </button>
            <label className="date-ligne">
              <span className="date-texte">{dateLisible(dateDe(s)) || 'Date à définir'}</span>
              <input type="date" aria-label="Changer la date de la séance" value={dateDe(s) || ''} onChange={(e) => changerDate(s, e.target.value)}
                onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* sélecteur indisponible */ } }} />
            </label>
            <button type="button" className="rond nu" aria-label="Supprimer la séance" onClick={() => supprimer(s.uid)}><Poubelle /></button>
          </div>
        ))}
      </section>

      {message && <p className="aide" role="status" style={{ margin: '16px 24px' }}>{message}</p>}
      <div style={{ height: 32 }} />
    </div>
  );
}
