import { useEffect, useState } from 'react';
import { donneesLocales, transfererDonneesLocales } from '../stockage.js';
import { connexionParMotDePasse, connexionGoogle, deconnexion } from '../supabase.js';
import { Retour, Oeil, OeilBarre, Google, Utilisateur, Note, Cloche, HautParleur, Lune, Nuage, Sortie, Info, Chrono } from './Icones.jsx';
import { etatSpotify, surSpotify, connecterSpotify, deconnecterSpotify } from '../spotify.js';
import { alerter } from './Dialogue.jsx';
import { voixAuto, enregistrerVoixAuto, savasanaGuide, enregistrerSavasana } from '../voix.js';
import { notifDisponible, notifSeance, enregistrerNotifSeance, autoriserNotifications } from '../seance-live.js';

// Écran « Compte » : profil, réglages de la séance en direct, musique, transfert des séances de l'appareil.
// Les textes explicatifs ne s'affichent qu'à la demande (bouton ⓘ).

// Bouton ⓘ : montre ou cache le texte d'explication qui le suit
function BoutonInfo({ ouvert, onClick, sujet }) {
  return (
    <button type="button" className={`bouton-info ${ouvert ? 'actif' : ''}`} aria-expanded={ouvert} aria-label={`${ouvert ? 'Masquer' : 'Afficher'} l'explication : ${sujet}`} onClick={onClick}><Info /></button>
  );
}

// Titre de carte avec picto, et explication facultative
function TitreCarte({ icone, titre, aide, children }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <div className="carte-titre">
        <span className="pastille-icone">{icone}</span>
        <h2>{titre}</h2>
        {children}
        {aide && <BoutonInfo ouvert={ouvert} sujet={titre} onClick={() => setOuvert(!ouvert)} />}
      </div>
      {aide && ouvert && <p className="aide carte-aide">{aide}</p>}
    </>
  );
}

// Ligne de réglage : picto, libellé, ⓘ, interrupteur ; explication sous la ligne à la demande
function Reglage({ icone, titre, aide, actif, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const id = `reglage-${titre.normalize('NFD').replace(/[^a-zA-Z]+/g, '-').toLowerCase()}`;
  return (
    <div className="reglage-ligne">
      <span className="pastille-icone petite">{icone}</span>
      <label className="reglage-libelle" htmlFor={id}>{titre}</label>
      <BoutonInfo ouvert={ouvert} sujet={titre} onClick={() => setOuvert(!ouvert)} />
      <input id={id} type="checkbox" role="switch" className="interrupteur" checked={actif} onChange={(e) => onChange(e.target.checked)} />
      {ouvert && <p className="reglage-aide">{aide}</p>}
    </div>
  );
}

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
      <TitreCarte icone={<Utilisateur />} titre="Connexion"
        aide="Réservée aux administrateurs : eux seuls peuvent modifier et régénérer les fiches. Avec Google, utilisez l'adresse enregistrée comme administrateur. Sans connexion, vos séances restent sur cet appareil." />
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
      <TitreCarte icone={<Note />} titre="Musique"
        aide={etat.connecte ? 'La musique de vos séances est choisie et jouée depuis ce compte Spotify (Premium requis pour la lecture automatique).' : 'Connectez votre compte Spotify pour accompagner chaque séance d\'une musique adaptée. Réservé aux comptes autorisés par l\'administrateur.'}>
        {etat.connecte && <span className="badge badge-spotify">Connecté</span>}
      </TitreCarte>
      {etat.connecte ? (
        <div className="compte-action">
          <span className="compte-nom">{etat.profil?.nom || 'Compte Spotify'}</span>
          <button type="button" className="lien" onClick={deconnecterSpotify}>Déconnecter</button>
        </div>
      ) : (
        <>
          {etat.erreur && <p className="erreur" role="alert">{etat.erreur}</p>}
          <button type="button" className="bouton-spotify" onClick={connecter} disabled={envoi}>{envoi ? 'Ouverture de Spotify…' : 'Connecter Spotify'}</button>
        </>
      )}
    </div>
  );
}

// Réglages de la séance en direct : notification (appli Android), guide audio et Savasana (administrateur)
function ReglagesSeance({ admin }) {
  const [notif, setNotif] = useState(notifSeance);
  const [auto, setAuto] = useState(voixAuto);
  const [savasana, setSavasana] = useState(savasanaGuide);
  const changerNotif = async (oui) => {
    if (oui && !(await autoriserNotifications())) {
      alerter({ titre: 'Notifications désactivées', message: 'Autorisez les notifications de « Mes séances Yoga » dans les paramètres d\'Android, puis réessayez.' });
      return;
    }
    enregistrerNotifSeance(oui);
    setNotif(oui);
  };
  if (!notifDisponible && !admin) return null;
  return (
    <div className="carte carte-compte">
      <TitreCarte icone={<Chrono />} titre="Séance en direct" aide="Réglages propres à cet appareil." />
      <div className="reglages">
        {notifDisponible && (
          <Reglage icone={<Cloche />} titre="Notification pendant la séance" actif={notif} onChange={changerNotif}
            aide="Posture en cours, compte à rebours et progression dans les notifications (en Live Update sur Android 16), avec Pause et Suivante. La séance continue aussi écran éteint." />
        )}
        {admin && (
          <Reglage icone={<HautParleur />} titre="Guide audio dès le début" actif={auto} onChange={(oui) => { enregistrerVoixAuto(oui); setAuto(oui); }}
            aide={auto ? 'La voix démarre dès l\'ouverture de la séance (elle se coupe toujours depuis le lecteur).' : 'La voix reste coupée au départ : on l\'active depuis le lecteur de la séance.'} />
        )}
        {admin && (
          <Reglage icone={<Lune />} titre="Relaxation guidée (Savasana)" actif={savasana} onChange={(oui) => { enregistrerSavasana(oui); setSavasana(oui); }}
            aide={savasana ? 'Avec la voix activée, une détente guidée accompagne la relaxation de fin de séance, puis le retour.' : 'La relaxation finale se fait en silence.'} />
        )}
      </div>
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
      </section>

      {/* Ordinateur : le compte à gauche, les réglages (séance en direct, musique) à droite */}
      <section className="cartes compte-cartes">
        <div className="compte-colonne">
        {!compte?.actif && <div className="carte"><p>La connexion n'est pas disponible sur cette version.</p></div>}
        {compte?.actif && (connecte ? (
          <div className="carte carte-compte">
            <TitreCarte icone={<Utilisateur />} titre="Votre compte"
              aide={`Vos séances sont enregistrées sur tous vos appareils.${compte.admin ? ' En tant qu\'administrateur, vous pouvez modifier et régénérer les fiches des postures.' : ''}`}>
              {compte.admin && <span className="badge badge-admin">Admin</span>}
            </TitreCarte>
            <div className="compte-action">
              <span className="compte-nom">{compte.email}</span>
              <button type="button" className="lien lien-icone" onClick={() => deconnexion()}><Sortie /> Se déconnecter</button>
            </div>
          </div>
        ) : <Connexion />)}
        {aTransferer && (
          <div className="carte carte-compte">
            <TitreCarte icone={<Nuage />} titre="Séances de cet appareil" aide="Séances créées sur cet appareil avant la connexion : une fois transférées, elles sont disponibles sur tous vos appareils." />
            <p>Cet appareil contient {locales.seances.length} séance{locales.seances.length > 1 ? 's enregistrées' : ' enregistrée'} avant la connexion.</p>
            <button type="button" className="principal bouton-compte" onClick={transferer}>Les transférer sur mon compte</button>
          </div>
        )}
        </div>
        <div className="compte-colonne">
        <ReglagesSeance admin={connecte && compte.admin} />
        <Spotify />
        </div>
      </section>

      {message && <p className="aide" role="status" style={{ margin: '16px 24px' }}>{message}</p>}
      <div style={{ height: 32 }} />
    </div>
  );
}
