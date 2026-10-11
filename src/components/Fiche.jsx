import { useEffect, useRef, useState } from 'react';
import Picto from './Picto.jsx';
import { Retour, Attention, Valide, Etincelle } from './Icones.jsx';
import { obtenirFiche, regenererFiche, enregistrerFiche, revenirReference as revenirRef, aUneReference } from '../stockage.js';

const CHAMPS_TEXTE = [
  ['respiration', 'Respiration'],
  ['sortie', 'Sortie'],
  ['variante_facilitee', 'Variante facilitée'],
  ['variante_avancee', 'Variante avancée'],
];

export default function Fiche({ posture, contexte, compte, onRetour }) {
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
    window.scrollTo(0, 0);
    setEtat(null);
    executer(() => obtenirFiche(posture.id, contexte));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posture.id]);

  const basculerValidation = () => executer(() => enregistrerFiche(posture.id, etat.fiche, !etat.validee));

  // Régénérer : seulement pour une fiche non validée (la validation sert de verrou)
  const regenerer = () => {
    if (!etat?.validee) executer(() => regenererFiche(posture.id, contexte));
  };

  const revenirReference = () => executer(() => revenirRef(posture.id));

  const commencerEdition = () => {
    const f = etat.fiche;
    setEdition({
      entree: (f.entree || []).join('\n'),
      alignement: (f.alignement || []).join('\n'),
      ...Object.fromEntries(CHAMPS_TEXTE.map(([k]) => [k, f[k] || ''])),
    });
  };

  const enregistrerEdition = async () => {
    const lignes = (t) => t.split('\n').map((s) => s.trim()).filter(Boolean);
    const fiche = { ...etat.fiche, ...edition, entree: lignes(edition.entree), alignement: lignes(edition.alignement), mode: 'gemini' };
    await executer(() => enregistrerFiche(posture.id, fiche, true));
    setEdition(null);
  };

  const f = etat?.fiche;
  const tenue = posture.minutes ? `${posture.minutes} min` : posture.respirations ? `${posture.respirations} respirations` : '';

  return (
    <div className="ecran">
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Retour à la séance" onClick={onRetour}><Retour /></button>
        <span className="sous">{tenue || posture.famille}</span>
        <span className="cale" />
      </header>

      <section className="fiche-tete">
        <div className="arche grande"><Picto famille={posture.famille} taille={130} /></div>
        <h1>{posture.fr}</h1>
        <p className="sous">{[posture.sanskrit, posture.en, `niveau ${posture.niveau}`].filter(Boolean).join(' · ')}</p>
        {posture.zones?.length > 0 && (
          <div className="badges" aria-label="Zones sollicitées">
            {posture.zones.map((z) => <span key={z} className="badge">{z}</span>)}
          </div>
        )}
      </section>
      {(posture.cotes || posture.accessoires || posture.preparations?.length > 0 || posture.contres?.length > 0) && (
        <p className="fiche-liens">
          {[posture.cotes ? 'Droite + gauche' : null, posture.accessoires ? `Accessoires : ${posture.accessoires.toLowerCase()}` : null].filter(Boolean).join(' · ')}
          {posture.preparations?.length > 0 && <><br />Se prépare avec : {posture.preparations.join(', ')}</>}
          {posture.contres?.length > 0 && <><br />Contre-posture : {posture.contres.join(', ')}</>}
        </p>
      )}

      {f && f.mode === 'gemini' && (
        <section className="bloc serre">
          <div className={`statut ${etat.validee ? 'ok' : 'attente'}`}>
            {etat.validee ? <Valide /> : <Etincelle />}
            <span>
              {etat.source === 'reference' ? 'Fiche de référence de votre bibliothèque'
                : etat.validee ? (etat.source === 'base' ? 'Fiche validée, partagée sur tous vos appareils' : 'Fiche validée, verrouillée')
                  : 'Rédigée par Gemini, à relire'}
            </span>
          </div>
        </section>
      )}

      <section className="cartes">
        {chargement && <div className="carte chargement" aria-live="polite">Rédaction de la fiche…</div>}
        {erreur && <div className="carte"><p className="erreur" role="alert">{erreur}</p><button type="button" className="secondaire" onClick={generer}>Réessayer</button></div>}

        {f && !edition && (
          <>
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
            <label>Entrée dans la posture <small>(une étape par ligne)</small>
              <textarea rows="5" value={edition.entree} onChange={(e) => setEdition({ ...edition, entree: e.target.value })} />
            </label>
            <label>Points d'alignement <small>(un par ligne)</small>
              <textarea rows="3" value={edition.alignement} onChange={(e) => setEdition({ ...edition, alignement: e.target.value })} />
            </label>
            {CHAMPS_TEXTE.map(([k, nom]) => (
              <label key={k}>{nom}
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
            {!etat.validee && (
              <button type="button" className="lien" onClick={regenerer}><Etincelle /> Régénérer la fiche</button>
            )}
            {etat.validee && etat.source !== 'reference' && (
              <p className="aide">Fiche validée : elle ne sera plus régénérée. Retirez la validation pour pouvoir la régénérer.</p>
            )}
            {etat.source === 'locale' && aUneReference(posture.id) && (
              <button type="button" className="lien" onClick={revenirReference}>Revenir à la fiche de la bibliothèque</button>
            )}
          </div>
        )}
      </section>

      <div className="ressort" />

      {f && f.mode === 'gemini' && !peutModifier && compte?.actif && !compte.email && (
        <p className="fiche-liens">Connectez-vous (écran « Mes séances et fiches ») pour valider ou modifier les fiches.</p>
      )}

      {f && f.mode === 'gemini' && peutModifier && (
        <footer className="pied deux">
          {edition ? (
            <>
              <button type="button" className="secondaire" onClick={() => setEdition(null)}>Annuler</button>
              <button type="button" className="principal" onClick={enregistrerEdition}>Enregistrer et valider</button>
            </>
          ) : (
            <>
              <button type="button" className="secondaire" onClick={commencerEdition}>Modifier</button>
              <button type="button" className="principal" onClick={basculerValidation}
                aria-label={etat.validee ? 'Retirer la validation' : 'Valider la fiche'}>
                {etat.validee ? 'Validée ✓' : 'Valider'}
              </button>
            </>
          )}
        </footer>
      )}
    </div>
  );
}
