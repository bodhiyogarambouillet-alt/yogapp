import { useEffect, useState } from 'react';
import Formulaire from './components/Formulaire.jsx';
import Seance from './components/Seance.jsx';
import Fiche from './components/Fiche.jsx';
import MesSeances from './components/MesSeances.jsx';
import ChargementSeance from './components/ChargementSeance.jsx';
import Compte from './components/Compte.jsx';
import { PAR_ID, chargerBibliotheque } from './bibliotheque.js';
import { enregistrerSeance, listerSeances } from './stockage.js';
import { stylesDe } from './styles-seance.js';
import { aujourdhui } from './dates.js';
import { urlApi } from './api.js';
import { useRetour } from './natif.js';
import { Logo } from './components/Icones.jsx';

// Grand écran (ordinateur) : la fiche s'ouvre dans un panneau à côté de la séance
function useGrandEcran() {
  const requete = '(min-width: 1024px)';
  const [grand, setGrand] = useState(() => window.matchMedia(requete).matches);
  useEffect(() => {
    const mq = window.matchMedia(requete);
    const maj = () => setGrand(mq.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  return grand;
}
import { supabase, enteteAuth } from './supabase.js';

// Recolle les données de la bibliothèque sur chaque posture (utile pour les séances enregistrées)
function hydrater(seance) {
  return {
    ...seance,
    phases: seance.phases.map((ph) => ({
      ...ph,
      items: ph.items.filter((it) => PAR_ID.has(it.id)).map((it) => ({ ...it, posture: PAR_ID.get(it.id) })),
    })),
  };
}

export default function App() {
  const [pret, setPret] = useState(false);
  const [vue, setVue] = useState('formulaire'); // formulaire | seance | fiche | mes-seances
  const [params, setParams] = useState(null);
  const [seance, setSeance] = useState(null);
  const [posture, setPosture] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [panneau, setPanneau] = useState(null); // posture affichée dans le panneau latéral (grand écran)
  const grandEcran = useGrandEcran();
  const [erreur, setErreur] = useState(null);
  const [enregistree, setEnregistree] = useState(false);
  // Compte : { actif: Supabase configuré, email, admin }
  const [compte, setCompte] = useState({ actif: Boolean(supabase), email: null, admin: false });

  // Bibliothèque (Supabase ou copie locale) avant le premier affichage
  useEffect(() => {
    chargerBibliotheque().finally(() => setPret(true));
  }, []);

  // Session Supabase : connexion par lien email, statut admin vérifié côté serveur
  useEffect(() => {
    if (!supabase) return undefined;
    const majCompte = async (session) => {
      if (!session) { setCompte({ actif: true, email: null, admin: false }); return; }
      let admin = false;
      try {
        const r = await fetch(urlApi('/api/moi'), { headers: await enteteAuth() });
        admin = Boolean((await r.json()).user?.admin);
      } catch { /* hors ligne : pas de droits admin */ }
      setCompte({ actif: true, email: session.user.email, admin });
    };
    supabase.auth.getSession().then(({ data }) => majCompte(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evt, session) => { majCompte(session); });
    return () => data.subscription.unsubscribe();
  }, []);

  const aller = (v) => { setVue(v); setPanneau(null); window.scrollTo(0, 0); };

  // Bouton retour d'Android : fiche → séance, autres écrans → formulaire (sur le formulaire : l'appli passe en arrière-plan)
  useRetour(pret && vue !== 'formulaire', () => aller(vue === 'fiche' && seance ? 'seance' : 'formulaire'));

  const generer = async (p) => {
    setParams(p);
    setChargement(true);
    setErreur(null);
    try {
      // « Éviter les répétitions » : postures des n dernières séances enregistrées
      let evites = [];
      if (p.eviterRepetition > 0) {
        try {
          const dernieres = (await listerSeances()).slice(0, p.eviterRepetition);
          evites = [...new Set(dernieres.flatMap((s) => s.phases.flatMap((ph) => ph.items.map((it) => it.id))))];
        } catch { /* séances illisibles : on compose sans */ }
      }
      const { eviterRepetition: _n, ...corps } = p;
      const r = await fetch(urlApi('/api/generer-seance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...corps, evites }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erreur || 'Erreur de génération');
      setSeance(hydrater({ ...data, uid: crypto.randomUUID(), dateSeance: seance?.dateSeance && vue === 'seance' ? seance.dateSeance : aujourdhui() }));
      setEnregistree(false);
      aller('seance');
    } catch (e) {
      setErreur(`La séance n'a pas pu être générée : ${e.message}`);
      if (vue !== 'formulaire') aller('formulaire');
    } finally {
      setChargement(false);
    }
  };

  const modifierSeance = (s) => { setSeance(s); setEnregistree(false); };

  const enregistrer = async () => {
    try {
      await enregistrerSeance(seance);
      setEnregistree(true);
    } catch (e) {
      window.alert(`Enregistrement impossible : ${e.message}`);
    }
  };

  if (!pret) {
    return <div className="ecran chargement-ecran" aria-live="polite"><p className="chargement">Chargement de la bibliothèque…</p></div>;
  }
  let ecran;
  if (vue === 'seance' && seance) {
    ecran = (
      <>
        <Seance seance={seance} chargement={chargement} enregistree={enregistree}
          onChange={modifierSeance}
          onRetour={() => aller('formulaire')}
          onRegenerer={() => generer(params || { styles: stylesDe(seance), accessoires: seance.accessoires ?? null, duree: seance.duree, niveau: seance.niveau, theme: seance.theme || '', cibleId: seance.cibleId || null, eviterRepetition: params?.eviterRepetition || 0 })}
          onEnregistrer={enregistrer}
          onOuvrirPosture={(p) => { if (grandEcran) setPanneau(p); else { setPosture(p); aller('fiche'); } }} />
        {grandEcran && panneau && (
          <aside className="panneau-fiche" aria-label={`Fiche : ${panneau.fr}`}>
            <Fiche key={panneau.id} posture={panneau} contexte={seance} compte={compte} panneau onRetour={() => setPanneau(null)} />
          </aside>
        )}
      </>
    );
  } else if (vue === 'fiche' && posture) {
    ecran = <Fiche posture={posture} contexte={seance} compte={compte} onRetour={() => aller(seance ? 'seance' : 'formulaire')} />;
  } else if (vue === 'mes-seances') {
    ecran = (
      <MesSeances compte={compte} onRetour={() => aller('formulaire')}
        onOuvrir={(s) => {
          const s2 = hydrater(s);
          setSeance(s2);
          setParams({ styles: stylesDe(s2), accessoires: s2.accessoires ?? [], duree: s2.duree, niveau: s2.niveau, theme: s2.theme || '', cibleId: s2.cibleId || null });
          setEnregistree(true);
          aller('seance');
        }} />
    );
  } else if (vue === 'compte') {
    ecran = <Compte compte={compte} onRetour={() => aller('formulaire')} />;
  } else {
    ecran = (
      <Formulaire initial={params} erreur={erreur} compte={compte}
        onGenerer={generer} onMesSeances={() => aller('mes-seances')} onCompte={() => aller('compte')} />
    );
  }

  // Pendant la composition : écran d'attente animé par-dessus l'écran courant
  if (chargement) ecran = <>{ecran}<ChargementSeance /></>;

  // Grand écran : barre de navigation en haut, comme sur un site
  if (!grandEcran) return ecran;
  const onglets = [['formulaire', 'Composer'], ...(seance ? [['seance', 'Séance en cours']] : []), ['mes-seances', 'Mes séances'], ['compte', compte.email ? 'Compte' : 'Se connecter']];
  return (
    <>
      <nav className="barre-app" aria-label="Navigation">
        <button type="button" className="barre-marque" onClick={() => aller('formulaire')}>
          <span className="accent"><Logo /></span><span>Mes séances Yoga</span>
        </button>
        <div className="barre-onglets">
          {onglets.map(([v, nomOnglet]) => (
            <button type="button" key={v} className={`barre-onglet ${vue === v ? 'actif' : ''}`} aria-current={vue === v ? 'page' : undefined}
              onClick={() => aller(v)}>{nomOnglet}</button>
          ))}
        </div>
      </nav>
      {ecran}
    </>
  );
}

