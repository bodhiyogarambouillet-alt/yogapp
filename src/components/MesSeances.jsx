import { useCallback, useEffect, useMemo, useState } from 'react';
import { listerSeances, supprimerSeance, enregistrerSeance, seancesEnCache } from '../stockage.js';
import { dateDe, dateLisible, aujourdhui } from '../dates.js';
import { Retour, Poubelle } from './Icones.jsx';
import { PAR_ID, nom } from '../bibliotheque.js';

const sansAccents = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Texte dans lequel cherche le filtre : titre, thème, intention, style, objectif et noms des postures
const texteRecherche = (s) => sansAccents([
  s.titre, s.theme, s.intention, s.style, s.niveau, s.cibleId && PAR_ID.get(s.cibleId) && nom(PAR_ID.get(s.cibleId)),
  ...(s.phases || []).flatMap((ph) => ph.items.map((it) => { const p = PAR_ID.get(it.id); return p ? `${p.fr} ${p.sanskrit || ''}` : ''; })),
].filter(Boolean).join(' '));

// Filtres gardés le temps de la session (on les retrouve en revenant d'une séance)
let memoire = { recherche: '', quand: null, style: null, niveau: null };

export default function MesSeances({ compte, onRetour, onOuvrir }) {
  // Copie gardée sur l'appareil : affichée tout de suite, puis remplacée par la liste à jour
  const [liste, setListe] = useState(() => seancesEnCache(compte?.email) || []);
  const [chargement, setChargement] = useState(() => !seancesEnCache(compte?.email));
  const [message, setMessage] = useState(null);

  const connecte = compte?.actif && compte.email;

  const [recherche, setRecherche] = useState(memoire.recherche);
  const [quand, setQuand] = useState(memoire.quand); // null | 'avenir' | 'passees'
  const [style, setStyle] = useState(memoire.style);
  const [niveau, setNiveau] = useState(memoire.niveau);
  useEffect(() => { memoire = { recherche, quand, style, niveau }; }, [recherche, quand, style, niveau]);
  const styles = useMemo(() => [...new Set(liste.map((s) => s.style).filter(Boolean))].sort(), [liste]);
  const niveaux = useMemo(() => [...new Set(liste.map((s) => s.niveau).filter(Boolean))], [liste]);
  const filtrees = useMemo(() => {
    const q = sansAccents(recherche.trim());
    const jour = aujourdhui();
    return liste.filter((s) => (!q || texteRecherche(s).includes(q))
      && (!quand || (quand === 'avenir' ? (dateDe(s) || '') >= jour : (dateDe(s) || '') < jour))
      && (!style || s.style === style) && (!niveau || s.niveau === niveau));
  }, [liste, recherche, quand, style, niveau]);
  const filtre = Boolean(recherche.trim() || quand || style || niveau);
  const effacer = () => { setRecherche(''); setQuand(null); setStyle(null); setNiveau(null); };
  const pastille = (actif, libelle, onClick) => (
    <button type="button" key={libelle} className={`badge choix ${actif ? 'actif' : ''}`} aria-pressed={actif} onClick={onClick}>{libelle}</button>
  );

  const recharger = useCallback(async () => {
    try {
      setListe(await listerSeances());
    } catch (e) {
      // Hors connexion : on garde la copie de l'appareil, sans alarmer
      if (!navigator.onLine && seancesEnCache(compte?.email)) setMessage('Hors connexion : séances gardées sur cet appareil.');
      else setMessage(`Lecture impossible : ${e.message}`);
    } finally {
      setChargement(false);
    }
  }, [compte?.email]);

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
      <header className="entete compact entete-onglet">
        <button type="button" className="rond" aria-label="Retour" onClick={onRetour}><Retour /></button>
        <span className="sous">Mes séances</span>
        <span className="cale" />
      </header>

      <section className="bloc">
        <h1 className="titre-section">Mes séances</h1>
        <p className="sous">{connecte ? 'Sur tous vos appareils.' : 'Enregistrées sur cet appareil.'}</p>
      </section>
      {liste.length > 1 && (
        <div className="biblio-outils seances-filtres">
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Titre, thème, posture…" aria-label="Rechercher une séance" />
          <div className="biblio-filtres" role="group" aria-label="Filtres">
            {pastille(quand === 'avenir', 'À venir', () => setQuand(quand === 'avenir' ? null : 'avenir'))}
            {pastille(quand === 'passees', 'Passées', () => setQuand(quand === 'passees' ? null : 'passees'))}
            {styles.length > 1 && styles.map((x) => pastille(style === x, x, () => setStyle(style === x ? null : x)))}
            {niveaux.length > 1 && niveaux.map((x) => pastille(niveau === x, x, () => setNiveau(niveau === x ? null : x)))}
          </div>
          {filtre && (
            <p className="seances-compte">{filtrees.length} séance{filtrees.length > 1 ? 's' : ''} sur {liste.length}
              <button type="button" className="lien" onClick={effacer}>Effacer les filtres</button></p>
          )}
        </div>
      )}

      <section className="cartes liste-seances">
        {chargement && liste.length === 0 && [0, 1, 2].map((i) => (
          <div key={i} className="carte squelette" aria-hidden="true">
            <span className="squelette-ligne longue" /><span className="squelette-ligne" /><span className="squelette-ligne courte" />
          </div>
        ))}
        {chargement && liste.length === 0 && <p className="sr-only" role="status">Chargement de vos séances…</p>}
        {!chargement && liste.length === 0 && <div className="carte"><p>Aucune séance enregistrée pour l'instant.</p></div>}
        {liste.length > 0 && filtrees.length === 0 && <div className="carte"><p>Aucune séance ne correspond à ces filtres.</p></div>}
        {filtrees.map((s) => (
          <div className="carte ligne-seance" key={s.uid}>
            <button type="button" className="ligne-lien" onClick={() => onOuvrir(s)}>
              <span className="ligne-texte">
                <span className="ligne-nom">{s.titre || s.theme || `Séance ${s.style}`}</span>
                <span className="ligne-infos">{[s.style, `${s.duree} min`, s.niveau].filter(Boolean).join(' · ')}</span>
                {s.cibleId && PAR_ID.get(s.cibleId) && <span className="ligne-infos seance-objectif">Objectif : {nom(PAR_ID.get(s.cibleId))}</span>}
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
