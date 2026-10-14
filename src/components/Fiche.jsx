import { useEffect, useRef, useState } from 'react';
import Picto from './Picto.jsx';
import { nom, nomSecondaire } from '../bibliotheque.js';
import { Retour, Attention, Valide, Etincelle, Fermer } from './Icones.jsx';
import { useRetour, estNatif } from '../natif.js';
import { Browser } from '@capacitor/browser';
import { obtenirFiche, regenererFiche, enregistrerFiche, revenirReference as revenirRef, aUneReference } from '../stockage.js';
import { confirmer } from './Dialogue.jsx';

// Recherche Google de la posture (noms sanskrit et français), dans le navigateur
function chercherSurGoogle(posture) {
  const q = [posture.sanskrit, posture.fr, 'posture yoga'].filter(Boolean).join(' ');
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  if (estNatif) Browser.open({ url }).catch(() => {});
  else window.open(url, '_blank', 'noopener');
}

// Listes éditées une ligne par élément
const CHAMPS_LISTE = [
  ['entree', 'Entrée dans la posture', 'une étape par ligne', 6],
  ['alignement', "Points d'alignement", 'un par ligne', 4],
  ['tenue', 'Pendant la posture', 'une consigne par ligne', 3],
  ['erreurs', 'Erreurs fréquentes', 'une par ligne', 3],
  ['resume', 'Résumé (séance en direct)', '3 consignes courtes, une par ligne', 3],
];

const CHAMPS_TEXTE = [
  ['presentation', 'Présentation'],
  ['respiration', 'Respiration'],
  ['souffle_court', 'Souffle en bref (séance en direct)'],
  ['sortie', 'Sortie'],
  ['variante_facilitee', 'Variante facilitée'],
  ['variante_avancee', 'Variante avancée'],
];

// panneau : fiche ouverte à côté de la séance sur grand écran
export default function Fiche({ posture, contexte, compte, onRetour, panneau = false }) {
  const [etat, setEtat] = useState(null); // { fiche, validee, source }
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [edition, setEdition] = useState(null);
  const enCours = useRef(false); // évite deux appels simultanés pour la même fiche

  // Avec Supabase, seuls les admins connectés valident, modifient ou régénèrent
  const peutModifier = !compte?.actif || compte.admin;

  const executer = async (action) => {
    if (enCours.current) return;
    enCours.current = true;
    setChargement(true);
    setErreur(null);
    try {
      setEtat(await action());
    } catch (e) {
      setErreur(e.message);
    } finally {
      enCours.current = false;
      setChargement(false);
    }
  };

  useEffect(() => {
    if (!panneau) window.scrollTo(0, 0);
    setEtat(null);
    executer(() => obtenirFiche(posture.id, contexte));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posture.id]);

  // Régénérer : recharge la fiche via Gemini et remplace celle enregistrée
  const regenerer = async () => {
    if (!(await confirmer({ titre: 'Régénérer la fiche ?', message: 'Gemini rédige une nouvelle version : le texte actuel sera remplacé.', ok: 'Régénérer' }))) return;
    executer(() => regenererFiche(posture.id, contexte));
  };

  const revenirReference = () => executer(() => revenirRef(posture.id));

  const commencerEdition = () => {
    const f = etat.fiche;
    setEdition({
      ...Object.fromEntries(CHAMPS_LISTE.map(([k]) => [k, (f[k] || []).join('\n')])),
      ...Object.fromEntries(CHAMPS_TEXTE.map(([k]) => [k, f[k] || ''])),
    });
  };

  const enregistrerEdition = async () => {
    const lignes = (t) => t.split('\n').map((s) => s.trim()).filter(Boolean);
    const fiche = { ...etat.fiche, ...edition, ...Object.fromEntries(CHAMPS_LISTE.map(([k]) => [k, lignes(edition[k])])), mode: 'gemini' };
    await executer(() => enregistrerFiche(posture.id, fiche, true));
    setEdition(null);
  };

  // Retour d'Android pendant une modification : annule la modification au lieu de quitter la fiche
  useRetour(Boolean(edition), () => setEdition(null), 1);

  const f = etat?.fiche;
  // Statut affiché sous les boutons Modifier / Régénérer (ou en bas de page sans ces boutons)
  const statut = f && f.mode === 'gemini' && !chargement && (
    <div className="statut ok statut-fiche">
      <Valide />
      <span>{etat.source === 'reference' ? 'Fiche de référence de votre bibliothèque' : 'Fiche enregistrée'}</span>
    </div>
  );
  const tenue = posture.minutes ? `${posture.minutes} min` : posture.respirations ? `${posture.respirations} respirations` : '';

  return (
    <div className={`ecran fiche ${panneau ? 'panneau' : ''}`}>
      <header className="entete compact">
        <button type="button" className="rond" aria-label={panneau ? 'Fermer la fiche' : 'Retour'} onClick={onRetour}>{panneau ? <Fermer /> : <Retour />}</button>
        <span className="sous">{tenue || posture.famille}</span>
        <span className="cale" />
      </header>

      <section className="fiche-tete">
        <div className="arche grande"><Picto famille={posture.famille} taille={130} /></div>
        <h1>{nom(posture)}</h1>
        <p className="sous">{[nomSecondaire(posture), posture.en, `niveau ${posture.niveau}`].filter(Boolean).join(' · ')}</p>
        {posture.zones?.length > 0 && (
          <div className="badges" aria-label="Zones sollicitées">
            {posture.zones.map((z) => <span key={z} className="badge">{z}</span>)}
          </div>
        )}
        <button type="button" className="fiche-google" onClick={() => chercherSurGoogle(posture)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          Rechercher sur Google
        </button>
      </section>
      {(posture.cotes || posture.accessoires || posture.preparations?.length > 0 || posture.contres?.length > 0) && (
        <p className="fiche-liens">
          {[posture.cotes ? 'Droite + gauche' : null, posture.accessoires ? `Accessoires : ${posture.accessoires.toLowerCase()}` : null].filter(Boolean).join(' · ')}
          {posture.preparations?.length > 0 && <><br />Se prépare avec : {posture.preparations.join(', ')}</>}
          {posture.contres?.length > 0 && <><br />Contre-posture : {posture.contres.join(', ')}</>}
        </p>
      )}


      <section className="cartes cartes-fiche">
        {chargement && <div className="carte chargement" aria-live="polite">Rédaction de la fiche…</div>}
        {erreur && <div className="carte"><p className="erreur" role="alert">{erreur}</p><button type="button" className="secondaire" onClick={() => executer(() => obtenirFiche(posture.id, contexte))}>Réessayer</button></div>}

        {f && !edition && (
          <>
            {f.presentation && (
              <div className="carte">
                <h2>La posture</h2>
                <p>{f.presentation}</p>
              </div>
            )}
            <div className="carte">
              <h2>Entrée</h2>
              <ol>{(f.entree || []).map((t, i) => <li key={i}>{t}</li>)}</ol>
            </div>
            {f.alignement?.length > 0 && (
              <div className="carte">
                <h2>Repères</h2>
                <ul>{f.alignement.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            {f.tenue?.length > 0 && (
              <div className="carte">
                <h2>Pendant la posture</h2>
                <ul>{f.tenue.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            {f.erreurs?.length > 0 && (
              <div className="carte">
                <h2>Erreurs fréquentes</h2>
                <ul>{f.erreurs.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            {(f.respiration || f.sortie) && (
              <div className="carte">
                {f.respiration && <><h2>Respiration</h2><p>{f.respiration}</p></>}
                {f.sortie && <><h2 style={{ marginTop: f.respiration ? 16 : 0 }}>Sortie</h2><p>{f.sortie}</p></>}
              </div>
            )}
            {(f.variante_facilitee || f.variante_avancee) && (
              <div className="carte variantes">
                <h2>Variantes</h2>
                {f.variante_facilitee && <p><strong className="facile">Plus simple :</strong> {f.variante_facilitee}</p>}
                {f.variante_avancee && <p><strong className="loin">Plus loin :</strong> {f.variante_avancee}</p>}
              </div>
            )}
          </>
        )}

        {edition && (
          <div className="carte edition">
            {CHAMPS_LISTE.map(([k, nomChamp, aide, lignes]) => (
              <label key={k}>{nomChamp} <small>({aide})</small>
                <textarea rows={lignes} value={edition[k]} onChange={(e) => setEdition({ ...edition, [k]: e.target.value })} />
              </label>
            ))}
            {CHAMPS_TEXTE.map(([k, nomChamp]) => (
              <label key={k}>{nomChamp}
                <textarea rows="2" value={edition[k]} onChange={(e) => setEdition({ ...edition, [k]: e.target.value })} />
              </label>
            ))}
          </div>
        )}

        {posture.precautions && (
          <div className="precautions">
            <Attention />
            <p><strong>Précautions :</strong> {posture.precautions}</p>
          </div>
        )}

        {f && f.mode === 'gemini' && !edition && !chargement && peutModifier && (
          <div className="actions-fiche">
            {etat.source === 'locale' && aUneReference(posture.id) && (
              <button type="button" className="lien" onClick={revenirReference}>Revenir à la fiche de la bibliothèque</button>
            )}
          </div>
        )}
      </section>

      <div className="ressort" />

      {!peutModifier && statut && <section className="bloc serre">{statut}</section>}

      {f && f.mode === 'gemini' && !peutModifier && compte?.actif && !compte.email && (
        <p className="fiche-liens">Connectez-vous en tant qu'administrateur (écran « Mes séances ») pour modifier ou régénérer les fiches.</p>
      )}

      {f && f.mode === 'gemini' && peutModifier && (
        <footer className="pied deux">
          {edition ? (
            <>
              <button type="button" className="secondaire" onClick={() => setEdition(null)}>Annuler</button>
              <button type="button" className="principal" onClick={enregistrerEdition}>Enregistrer</button>
            </>
          ) : (
            <>
              <button type="button" className="secondaire" onClick={commencerEdition}>Modifier</button>
              <button type="button" className="principal" onClick={regenerer}><Etincelle /> Régénérer</button>
            </>
          )}
          {!edition && statut}
        </footer>
      )}
    </div>
  );
}
