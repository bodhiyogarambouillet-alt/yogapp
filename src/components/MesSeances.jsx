import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listerSeances, supprimerSeance, fichesValidees, importerFiches, donneesLocales, transfererDonneesLocales,
} from '../stockage.js';
import { connexionParEmail, connexionParMotDePasse, deconnexion } from '../supabase.js';
import { Retour, Poubelle } from './Icones.jsx';
import { PAR_ID } from '../bibliotheque.js';

// Fichier d'export : sauvegarde lisible et réimportable
function telecharger(fiches) {
  const contenu = {
    format: 'yoga-app/fiches',
    version: 1,
    exporteLe: new Date().toISOString(),
    fiches: Object.fromEntries(Object.entries(fiches).map(([id, f]) => {
      const { mode: _m, modele: _mo, statut: _s, source: _so, ...reste } = f;
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

function Connexion() {
  const [email, setEmail] = useState('');
  const [admin, setAdmin] = useState(false); // connexion administrateur : email + mot de passe
  const [motDePasse, setMotDePasse] = useState('');
  const [etat, setEtat] = useState(null); // null | 'envoi' | 'envoye' | message d'erreur
  const envoyer = async (e) => {
    e.preventDefault();
    setEtat('envoi');
    try {
      if (admin) {
        await connexionParMotDePasse(email, motDePasse); // la session met l'écran à jour
        setEtat(null);
        return;
      }
      await connexionParEmail(email);
      setEtat('envoye');
    } catch (err) {
      setEtat(admin ? err.message : `Envoi impossible : ${err.message}`);
    }
  };
  if (etat === 'envoye') {
    return <div className="carte"><p>Un lien de connexion vient d'être envoyé à <strong>{email}</strong>. Ouvrez-le sur cet appareil.</p></div>;
  }
  return (
    <form className="carte connexion" onSubmit={envoyer}>
      <h2>Se connecter</h2>
      <p className="aide" style={{ marginTop: 0 }}>
        {admin ? 'Accès administrateur : email et mot de passe.' : 'Pour retrouver vos séances et vos fiches sur tous vos appareils. Pas de mot de passe : un lien arrive par email.'}
      </p>
      <label htmlFor="email" className="etiquette">Email</label>
      <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
      {admin && (
        <>
          <label htmlFor="mdp" className="etiquette" style={{ marginTop: 12 }}>Mot de passe</label>
          <input id="mdp" type="password" required autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
        </>
      )}
      {etat && etat !== 'envoi' && <p className="erreur" role="alert">{etat}</p>}
      <button type="submit" className="principal" disabled={etat === 'envoi'}>
        {etat === 'envoi' ? (admin ? 'Connexion…' : 'Envoi…') : admin ? 'Se connecter' : 'Recevoir le lien'}
      </button>
      <button type="button" className="lien" onClick={() => { setAdmin(!admin); setEtat(null); setMotDePasse(''); }}>
        {admin ? 'Retour à la connexion par lien' : 'Je suis administrateur'}
      </button>
    </form>
  );
}

export default function MesSeances({ compte, onRetour, onOuvrir }) {
  const [liste, setListe] = useState([]);
  const [fiches, setFiches] = useState({});
  const [message, setMessage] = useState(null);
  const [locales, setLocales] = useState(donneesLocales);
  const entreeFichier = useRef(null);

  const connecte = compte?.actif && compte.email;
  const peutGererFiches = !compte?.actif || compte.admin;

  const recharger = useCallback(async () => {
    try {
      setListe(await listerSeances());
      setFiches(peutGererFiches ? await fichesValidees() : {});
      setLocales(donneesLocales());
    } catch (e) {
      setMessage(`Lecture impossible : ${e.message}`);
    }
  }, [peutGererFiches]);

  useEffect(() => { recharger(); }, [recharger, compte?.email]);

  const supprimer = async (uid) => {
    try {
      await supprimerSeance(uid);
      recharger();
    } catch (e) {
      setMessage(`Suppression impossible : ${e.message}`);
    }
  };

  const importer = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    try {
      const donnees = JSON.parse(await fichier.text());
      const brutes = donnees.fiches || donnees;
      const connues = Object.fromEntries(Object.entries(brutes).filter(([id]) => PAR_ID.has(id)));
      const n = await importerFiches(connues);
      const ignorees = Object.keys(brutes).length - Object.keys(connues).length;
      setMessage(`${n} fiche(s) importée(s)${ignorees ? `, ${ignorees} ignorée(s) (postures inconnues)` : ''}.`);
      recharger();
    } catch (err) {
      setMessage(err instanceof SyntaxError ? 'Fichier illisible : choisissez un export « fiches-validees-….json ».' : err.message);
    }
  };

  const transferer = async () => {
    try {
      const { nSeances, nFiches } = await transfererDonneesLocales({ admin: compte.admin });
      setMessage(`Transféré : ${nSeances} séance(s) et ${nFiches} fiche(s) validée(s).`);
      recharger();
    } catch (e) {
      setMessage(`Transfert impossible : ${e.message}`);
    }
  };

  const ids = Object.keys(fiches).sort((a, b) => (PAR_ID.get(a)?.fr || a).localeCompare(PAR_ID.get(b)?.fr || b, 'fr'));
  const aTransferer = connecte && (locales.seances.length > 0 || (compte.admin && Object.keys(locales.fiches).length > 0));

  return (
    <div className="ecran">
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Retour" onClick={onRetour}><Retour /></button>
        <span className="sous">Mes séances et fiches</span>
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
                Cet appareil contient {locales.seances.length} séance(s)
                {compte.admin ? ` et ${Object.keys(locales.fiches).length} fiche(s) validée(s)` : ''} enregistrées avant la connexion.
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
                {s.cibleId && PAR_ID.get(s.cibleId) && <span className="ligne-infos">Objectif : {PAR_ID.get(s.cibleId).fr}</span>}
                <span className="ligne-infos">{s.titre || s.theme || ''}</span>
                {s.enregistreeLe && <span className="ligne-infos">{new Date(s.enregistreeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
              </span>
            </button>
            <button type="button" className="rond nu" aria-label="Supprimer la séance" onClick={() => supprimer(s.uid)}><Poubelle /></button>
          </div>
        ))}
      </section>

      {peutGererFiches && (
        <>
          <section className="bloc">
            <h1 className="titre-section">Fiches validées</h1>
            <p className="sous">{ids.length} fiche(s) validée(s){compte?.actif ? ', partagées sur tous vos appareils' : ' sur cet appareil'}.</p>
          </section>
          <section className="cartes">
            <div className="carte">
              <div className="actions-export">
                <button type="button" className="secondaire" disabled={ids.length === 0} onClick={() => telecharger(fiches)}>Exporter</button>
                <button type="button" className="secondaire" onClick={() => entreeFichier.current?.click()}>Importer</button>
                <input ref={entreeFichier} type="file" accept="application/json,.json" hidden onChange={importer} />
              </div>
              <p className="aide">« Exporter » télécharge une sauvegarde de vos fiches validées ; « Importer » la recharge.</p>
            </div>
            {ids.length > 0 && (
              <div className="carte liste-fiches">
                {ids.map((id) => <span key={id} className="badge">{PAR_ID.get(id)?.fr || id}</span>)}
              </div>
            )}
          </section>
        </>
      )}

      {message && <p className="aide" role="status" style={{ margin: '16px 24px' }}>{message}</p>}
      <div style={{ height: 32 }} />
    </div>
  );
}
