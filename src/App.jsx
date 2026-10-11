import { useState } from 'react';
import Formulaire from './components/Formulaire.jsx';
import Seance from './components/Seance.jsx';
import Fiche from './components/Fiche.jsx';
import MesSeances from './components/MesSeances.jsx';
import { PAR_ID } from './bibliotheque.js';
import { enregistrerSeance, listerSeances } from './stockage.js';

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
  const [vue, setVue] = useState('formulaire'); // formulaire | seance | fiche | mes-seances
  const [params, setParams] = useState(null);
  const [seance, setSeance] = useState(null);
  const [posture, setPosture] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [enregistree, setEnregistree] = useState(false);

  const aller = (v) => { setVue(v); window.scrollTo(0, 0); };

  const generer = async (p) => {
    setParams(p);
    setChargement(true);
    setErreur(null);
    try {
      const r = await fetch('/api/generer-seance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erreur || 'Erreur de génération');
      setSeance(hydrater({ ...data, uid: crypto.randomUUID() }));
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

  const enregistrer = () => {
    const allegee = { ...seance, phases: seance.phases.map((ph) => ({ ...ph, items: ph.items.map(({ posture: _p, ...it }) => it) })) };
    if (enregistrerSeance(allegee)) setEnregistree(true);
  };

  if (vue === 'seance' && seance) {
    return (
      <Seance seance={seance} chargement={chargement} enregistree={enregistree}
        onChange={modifierSeance}
        onRetour={() => aller('formulaire')}
        onRegenerer={() => generer(params || { style: seance.style, duree: seance.duree, niveau: seance.niveau, theme: seance.theme || '', cibleId: seance.cibleId || null })}
        onEnregistrer={enregistrer}
        onOuvrirPosture={(p) => { setPosture(p); aller('fiche'); }} />
    );
  }
  if (vue === 'fiche' && posture) {
    return <Fiche posture={posture} contexte={seance} onRetour={() => aller(seance ? 'seance' : 'formulaire')} />;
  }
  if (vue === 'mes-seances') {
    return (
      <MesSeances onRetour={() => aller('formulaire')}
        onOuvrir={(s) => {
          const s2 = hydrater(s);
          setSeance(s2);
          setParams({ style: s2.style, duree: s2.duree, niveau: s2.niveau, theme: s2.theme || '', cibleId: s2.cibleId || null });
          setEnregistree(listerSeances().some((x) => x.uid === s2.uid));
          aller('seance');
        }} />
    );
  }
  return (
    <Formulaire initial={params} chargement={chargement} erreur={erreur}
      onGenerer={generer} onMesSeances={() => aller('mes-seances')} />
  );
}
