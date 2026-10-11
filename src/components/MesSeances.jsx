import { useCallback, useEffect, useState } from 'react';
import { listerSeances, supprimerSeance, donneesLocales, transfererDonneesLocales } from '../stockage.js';
import { connexionParMotDePasse, deconnexion } from '../supabase.js';
import { Retour, Poubelle } from './Icones.jsx';
import { PAR_ID, nom } from '../bibliotheque.js';

function Connexion() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [etat, setEtat] = useState(null); // null | 'envoi' | message d'erreur
  const envoyer = async (e) => {
    e.preventDefault();
    setEtat('envoi');
    try {
      await connexionParMotDePasse(email, motDePasse); // la session met l'écran à jour
      setEtat(null);
    } catch (err) {
      setEtat(err.message);
    }
  };
  return (
    <form className="carte connexion" onSubmit={envoyer}>
      <h2>Connexion administrateur</h2>
      <p className="aide" style={{ marginTop: 0 }}>Réservée aux administrateurs : eux seuls peuvent modifier et régénérer les fiches.</p>
      <label htmlFor="email" className="etiquette">Email</label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
      <label htmlFor="mdp" className="etiquette" style={{ marginTop: 12 }}>Mot de passe</label>
      <input id="mdp" type="password" required autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
      {etat && etat !== 'envoi' && <p className="erreur" role="alert">{etat}</p>}
      <button type="submit" className="principal" disabled={etat === 'envoi'}>{etat === 'envoi' ? 'Connexion…' : 'Se connecter'}</button>
    </form>
  );
}

export default function MesSeances({ compte, onRetour, onOuvrir }) {
  const [liste, setListe] = useState([]);
  const [message, setMessage] = useState(null);
  const [locales, setLocales] = useState(donneesLocales);

  const connecte = compte?.actif && compte.email;

  const recharger = useCallback(async () => {
    try {
      setListe(await listerSeances());
      setLocales(donneesLocales());
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

  const transferer = async () => {
    try {
      const { nSeances } = await transfererDonneesLocales();
      setMessage(`${nSeances} séance(s) transférée(s) sur votre compte.`);
      recharger();
    } catch (e) {
      setMessage(`Transfert impossible : ${e.message}`);
    }
  };

  const aTransferer = connecte && locales.seances.length > 0;

  return (
    <div className="ecran">
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Retour" onClick={onRetour}><Retour /></button>
        <span className="sous">Mes séances</span>
        <span className="cale" />
      </header>

      {compte?.actif && (
        <section className="cartes">
          {connecte ? (
            <div className="carte compte">
              <p>Connecté : <strong>{compte.email}</strong>{compte.admin && <span className="badge" style={{ marginLeft: 8 }}>Admin</span>}</p>
              <button type="button" className="lien" onClick={() => deconnexion()}>Se déconnecter</button>
            </div>
          ) : <Connexion />}
          {aTransferer && (
            <div className="carte">
              <p>
                Cet appareil contient {locales.seances.length} séance(s) enregistrée(s) avant la connexion.
              </p>
              <button type="button" className="principal" style={{ marginTop: 12, width: '100%' }} onClick={transferer}>Les transférer sur mon compte</button>
            </div>
          )}
        </section>
      )}

      <section className="bloc">
        <h1 className="titre-section">Mes séances</h1>
        <p className="sous">{connecte ? 'Sur tous vos appareils.' : 'Enregistrées sur cet appareil.'}</p>
      </section>
      <section className="cartes">
        {liste.length === 0 && <div className="carte"><p>Aucune séance enregistrée pour l'instant.</p></div>}
        {liste.map((s) => (
          <div className="carte ligne-seance" key={s.uid}>
            <button type="button" className="ligne-lien" onClick={() => onOuvrir(s)}>
              <span className="ligne-texte">
                <span className="ligne-nom">{s.style} · {s.duree} min · {s.niveau}</span>
                {s.cibleId && PAR_ID.get(s.cibleId) && <span className="ligne-infos">Objectif : {nom(PAR_ID.get(s.cibleId))}</span>}
                <span className="ligne-infos">{s.titre || s.theme || ''}</span>
                {s.enregistreeLe && <span className="ligne-infos">{new Date(s.enregistreeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
              </span>
            </button>
            <button type="button" className="rond nu" aria-label="Supprimer la séance" onClick={() => supprimer(s.uid)}><Poubelle /></button>
          </div>
        ))}
      </section>

      {message && <p className="aide" role="status" style={{ margin: '16px 24px' }}>{message}</p>}
      <div style={{ height: 32 }} />
    </div>
  );
}
