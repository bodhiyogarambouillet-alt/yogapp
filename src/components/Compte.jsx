import { useEffect, useState } from 'react';
import { donneesLocales, transfererDonneesLocales } from '../stockage.js';
import { connexionParMotDePasse, connexionGoogle, deconnexion } from '../supabase.js';
import { Retour, Oeil, OeilBarre, Google } from './Icones.jsx';
import { etatSpotify, surSpotify, connecterSpotify, deconnecterSpotify } from '../spotify.js';
import { alerter } from './Dialogue.jsx';
import { voixAuto, enregistrerVoixAuto } from '../voix.js';

// Écran « Compte » : connexion administrateur, déconnexion et transfert des séances de l'appareil

function Connexion() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [voir, setVoir] = useState(false); // afficher le mot de passe en clair
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
  const google = async () => {
    setEtat('envoi');
    try {
      await connexionGoogle(); // la session met l'écran à jour au retour de Google
      setEtat(null);
    } catch (err) {
      setEtat(`Connexion Google impossible : ${err.message}`);
    }
  };
  return (
    <form className="carte connexion" onSubmit={envoyer}>
      <h2>Connexion administrateur</h2>
      <p className="aide" style={{ marginTop: 0 }}>Réservée aux administrateurs : eux seuls peuvent modifier et régénérer les fiches. Avec Google, utilisez l'adresse enregistrée comme administrateur.</p>
      <button type="button" className="bouton-google" onClick={google} disabled={etat === 'envoi'}><Google /> Continuer avec Google</button>
      <p className="separateur"><span>ou</span></p>
      <label htmlFor="email" className="etiquette">Email</label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
      <label htmlFor="mdp" className="etiquette" style={{ marginTop: 12 }}>Mot de passe</label>
      <div className="champ-mdp">
        <input id="mdp" type={voir ? 'text' : 'password'} required autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
        <button type="button" className="voir-mdp" aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={voir} onClick={() => setVoir(!voir)}>
          {voir ? <OeilBarre /> : <Oeil />}
        </button>
      </div>
      {etat && etat !== 'envoi' && <p className="erreur" role="alert">{etat}</p>}
      <button type="submit" className="principal" disabled={etat === 'envoi'}>{etat === 'envoi' ? 'Connexion…' : 'Se connecter'}</button>
    </form>
  );
}

// Compte Spotify : sert à créer des playlists pour les séances (indépendant du compte de l'appli)
function Spotify() {
  const [etat, setEtat] = useState(etatSpotify);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => surSpotify((e) => { setEtat(e); setEnvoi(false); }), []);
  const connecter = async () => {
    setEnvoi(true);
    try {
      await connecterSpotify();
    } catch (e) {
      setEnvoi(false);
      alerter({ titre: 'Connexion Spotify impossible', message: e.message });
    }
  };
  return (
    <div className="carte carte-compte">
      <h2>Musique · Spotify</h2>
      {etat.connecte ? (
        <>
          <p className="compte-ligne"><span className="compte-nom">{etat.profil?.nom || 'Compte Spotify'}</span><span className="badge badge-spotify">Connecté</span></p>
          <p className="aide">Les playlists de vos séances sont créées dans ce compte.</p>
          <button type="button" className="lien" onClick={deconnecterSpotify}>Déconnecter Spotify</button>
        </>
      ) : (
        <>
          <p className="aide">Connectez votre compte Spotify pour créer une playlist adaptée à chaque séance. Réservé aux comptes autorisés par l'administrateur.</p>
          {etat.erreur && <p className="erreur" role="alert">{etat.erreur}</p>}
          <button type="button" className="bouton-spotify" onClick={connecter} disabled={envoi}>{envoi ? 'Ouverture de Spotify…' : 'Connecter Spotify'}</button>
        </>
      )}
    </div>
  );
}

// Réglage administrateur : guide audio lancé ou non dès le début de la séance
function GuideAudio() {
  const [auto, setAuto] = useState(voixAuto);
  const changer = (oui) => { enregistrerVoixAuto(oui); setAuto(oui); };
  return (
    <div className="carte carte-compte">
      <h2>Guide audio</h2>
      <label className="reglage">
        <span>Lancer le guide audio au début de la séance</span>
        <input type="checkbox" role="switch" className="interrupteur" checked={auto} onChange={(e) => changer(e.target.checked)} />
      </label>
      <p className="aide">{auto ? 'La voix démarre dès l\'ouverture de la séance (elle se coupe toujours depuis le lecteur).' : 'La voix reste coupée au départ : on l\'active depuis le lecteur de la séance.'} Réglage propre à cet appareil.</p>
    </div>
  );
}

export default function Compte({ compte, onRetour }) {
  const [message, setMessage] = useState(null);
  const [locales, setLocales] = useState(donneesLocales);
  const connecte = compte?.actif && compte.email;
  const aTransferer = connecte && locales.seances.length > 0;

  const transferer = async () => {
    try {
      const { nSeances } = await transfererDonneesLocales();
      setMessage(`${nSeances} séance(s) transférée(s) sur votre compte.`);
      setLocales(donneesLocales());
    } catch (e) {
      setMessage(`Transfert impossible : ${e.message}`);
    }
  };

  return (
    <div className="ecran">
      <header className="entete compact entete-onglet">
        <button type="button" className="rond" aria-label="Retour" onClick={onRetour}><Retour /></button>
        <span className="sous">Compte</span>
        <span className="cale" />
      </header>

      <section className="bloc">
        <h1 className="titre-section">Compte</h1>
        <p className="sous">{connecte ? 'Vos séances sont enregistrées sur tous vos appareils.' : 'Sans connexion, vos séances restent sur cet appareil.'}</p>
      </section>

      <section className="cartes">
        {!compte?.actif && <div className="carte"><p>La connexion n'est pas disponible sur cette version.</p></div>}
        {compte?.actif && (connecte ? (
          <div className="carte carte-compte">
            <h2>Votre compte</h2>
            <p className="compte-ligne"><span className="compte-nom">{compte.email}</span>{compte.admin && <span className="badge badge-admin">Admin</span>}</p>
            <p className="aide">{compte.admin ? 'Vous pouvez modifier et régénérer les fiches des postures.' : 'Vos séances sont synchronisées sur vos appareils.'}</p>
            <button type="button" className="lien" onClick={() => deconnexion()}>Se déconnecter</button>
          </div>
        ) : <Connexion />)}
        {connecte && compte.admin && <GuideAudio />}
        <Spotify />
        {aTransferer && (
          <div className="carte carte-compte">
            <h2>Séances de cet appareil</h2>
            <p>Cet appareil contient {locales.seances.length} séance(s) enregistrée(s) avant la connexion.</p>
            <button type="button" className="principal" style={{ alignSelf: 'stretch', marginTop: 4 }} onClick={transferer}>Les transférer sur mon compte</button>
          </div>
        )}
      </section>

      {message && <p className="aide" role="status" style={{ margin: '16px 24px' }}>{message}</p>}
      <div style={{ height: 32 }} />
    </div>
  );
}
