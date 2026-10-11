import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Picto from './Picto.jsx';
import { nom, nomSecondaire } from '../bibliotheque.js';
import { Fermer, Lecture, Pause, Suivant, Precedent, Attention } from './Icones.jsx';
import { obtenirFiche } from '../stockage.js';
import { useRetour, vibrer } from '../natif.js';

// Fiches « Comment faire ? » de la séance : chargées à la demande (posture en cours + suivante), gardées en mémoire
function useFiches(seance) {
  const [fiches, setFiches] = useState({});
  const demandees = useRef(new Set());
  const charger = useCallback((id) => {
    if (!id || demandees.current.has(id)) return;
    demandees.current.add(id);
    obtenirFiche(id, seance)
      .then(({ fiche }) => setFiches((f) => ({ ...f, [id]: fiche?.mode === 'gemini' ? fiche : null })))
      .catch(() => setFiches((f) => ({ ...f, [id]: null })));
  }, [seance]);
  return { fiches, charger };
}

// Mini résumé de la posture, plié par défaut : repères clés, respiration, précautions, entrée dans la posture
function Resume({ posture, fiche }) {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => setOuvert(false), [posture.id]);
  const reperes = fiche?.alignement || [];
  if (fiche !== undefined && !fiche && !posture.precautions) return null;
  return (
    <div className={`live-resume ${ouvert ? 'ouvert' : ''}`} key={posture.id}>
      <button type="button" className="live-resume-tete" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
        <span>Résumé de la posture</span>
        {posture.precautions && <span className="live-resume-alerte" aria-label="Précautions"><Attention /></span>}
        <span className="live-resume-fleche" aria-hidden="true">▾</span>
      </button>
      {ouvert && (
        <div className="live-resume-corps">
          {fiche === undefined && <p className="aide chargement-resume">Chargement des repères…</p>}
          {reperes.length > 0 && <ul className="live-reperes">{reperes.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}</ul>}
          {fiche?.respiration && <p className="live-souffle"><strong>Souffle :</strong> {fiche.respiration}</p>}
          {posture.precautions && <p className="live-precaution"><Attention /> {posture.precautions}</p>}
          {fiche?.entree?.length > 0 && (
            <>
              <p className="live-sous-titre">Comment s’installer</p>
              <ol className="live-entree">{fiche.entree.map((t, i) => <li key={i}>{t}</li>)}</ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Durée « brute » d'une posture d'après sa consigne (« 5 respirations », « 3 min », « × 3 tours »)
function poids(it) {
  const d = (it.duree || '').toLowerCase();
  const p = it.posture;
  let m;
  if ((m = d.match(/(\d+(?:[.,]\d+)?)\s*min/))) return parseFloat(m[1].replace(',', '.')) * 60;
  if ((m = d.match(/(\d+)\s*resp/))) return Number(m[1]) * 6 * (p.cotes ? 2 : 1);
  if ((m = d.match(/(\d+)\s*tour/))) return Number(m[1]) * 60;
  if (p.minutes) return p.minutes * 60;
  if (p.respirations) return p.respirations * 6 * (p.cotes ? 2 : 1);
  return 60;
}

// Déroulé : chaque phase garde sa durée, répartie entre ses postures selon leur poids
function etapesDe(seance) {
  return seance.phases.flatMap((ph) => {
    if (!ph.items.length) return [];
    const poidsPhase = ph.items.map(poids);
    const somme = poidsPhase.reduce((a, b) => a + b, 0) || 1;
    return ph.items.map((it, i) => ({
      ...it, phase: ph.phase, secondes: Math.max(15, Math.round((poidsPhase[i] / somme) * ph.minutes * 60)),
    }));
  });
}

const mmss = (s) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

// Petit signal sonore + vibration aux changements
function useSignal() {
  const ctx = useRef(null);
  const activer = useCallback(() => {
    try {
      ctx.current = ctx.current || new (window.AudioContext || window.webkitAudioContext)();
      ctx.current.resume?.();
    } catch { /* audio indisponible */ }
  }, []);
  const sonner = useCallback((frequence = 660, fois = 1) => {
    try {
      const c = ctx.current;
      if (!c) return;
      for (let i = 0; i < fois; i++) {
        const o = c.createOscillator();
        const g = c.createGain();
        const t = c.currentTime + i * 0.22;
        o.frequency.value = frequence;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + 0.55);
      }
    } catch { /* audio indisponible */ }
  }, []);
  return { activer, sonner };
}

// L'écran reste allumé pendant la séance (si le navigateur le permet)
function useEcranAllume(actif) {
  useEffect(() => {
    if (!actif || !navigator.wakeLock) return undefined;
    let verrou = null;
    const demander = () => navigator.wakeLock.request('screen').then((v) => { verrou = v; }).catch(() => {});
    const auRetour = () => { if (document.visibilityState === 'visible') demander(); };
    demander();
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      document.removeEventListener('visibilitychange', auRetour);
      verrou?.release().catch(() => {});
    };
  }, [actif]);
}

export default function Live({ seance, onQuitter }) {
  const etapes = useMemo(() => etapesDe(seance), [seance]);
  const total = useMemo(() => etapes.reduce((s, e) => s + e.secondes, 0), [etapes]);
  const [index, setIndex] = useState(0);
  const [restant, setRestant] = useState(etapes[0]?.secondes || 0); // secondes restantes sur l'étape
  const [enCours, setEnCours] = useState(false);
  const [terminee, setTerminee] = useState(false);
  const fin = useRef(null); // horodatage de fin de l'étape en cours (si en marche)
  const coteSignale = useRef(false);
  const { activer, sonner } = useSignal();
  const { fiches, charger } = useFiches(seance);
  useEcranAllume(enCours);

  const etape = etapes[index];
  const suivante = etapes[index + 1];

  // Résumé de la posture en cours, et préchargement de la suivante
  useEffect(() => {
    charger(etape?.id);
    charger(suivante?.id);
  }, [etape?.id, suivante?.id, charger]);

  const allerA = useCallback((i, demarrer) => {
    if (i >= etapes.length) {
      setEnCours(false);
      setTerminee(true);
      fin.current = null;
      sonner(520, 3);
      vibrer(600);
      return;
    }
    const j = Math.max(0, i);
    setIndex(j);
    setRestant(etapes[j].secondes);
    coteSignale.current = false;
    fin.current = demarrer ? Date.now() + etapes[j].secondes * 1000 : null;
  }, [etapes, sonner]);

  // Horloge : basée sur l'heure réelle, pas sur le nombre de « tics » (fiable en arrière-plan)
  useEffect(() => {
    if (!enCours) return undefined;
    const tic = setInterval(() => {
      const r = (fin.current - Date.now()) / 1000;
      if (r <= 0) {
        sonner(index + 1 < etapes.length && etapes[index + 1].phase !== etape.phase ? 880 : 660, 2);
        if (index + 1 < etapes.length) vibrer(200); // courte vibration à chaque changement de posture
        allerA(index + 1, true);
        return;
      }
      // Posture des deux côtés : signal à mi-parcours
      if (etape.posture.cotes && !coteSignale.current && r <= etape.secondes / 2) {
        coteSignale.current = true;
        sonner(740, 1);
        vibrer(120);
      }
      setRestant(r);
    }, 250);
    return () => clearInterval(tic);
  }, [enCours, index, etape, etapes, allerA, sonner]);

  const basculer = () => {
    activer();
    if (terminee) return;
    if (enCours) {
      setRestant((fin.current - Date.now()) / 1000);
      fin.current = null;
      setEnCours(false);
    } else {
      fin.current = Date.now() + restant * 1000;
      setEnCours(true);
    }
  };

  // Précédent : revient au début de la posture, ou à la précédente si on vient de commencer
  const precedent = () => {
    activer();
    const ecoule = etape.secondes - restant;
    allerA(ecoule > 5 ? index : index - 1, enCours);
  };
  const suivant = () => { activer(); allerA(index + 1, enCours); };
  const ajouter = (s) => {
    setRestant((r) => r + s);
    if (fin.current) fin.current += s * 1000;
  };

  const quitter = () => {
    if (enCours && !window.confirm('Arrêter la séance en cours ?')) return;
    onQuitter();
  };
  useRetour(true, () => quitter(), 2);

  if (!etapes.length) {
    return (
      <div className="ecran live">
        <header className="entete compact"><button type="button" className="rond" aria-label="Quitter" onClick={onQuitter}><Fermer /></button></header>
        <p className="aide" style={{ margin: 24 }}>Cette séance ne contient aucune posture.</p>
      </div>
    );
  }

  const ecouleAvant = etapes.slice(0, index).reduce((s, e) => s + e.secondes, 0);
  const ecoule = terminee ? total : ecouleAvant + (etape.secondes - restant);
  const fraction = terminee ? 1 : 1 - restant / etape.secondes;
  const rayon = 92;
  const circonference = 2 * Math.PI * rayon;
  const cote = etape.posture.cotes ? (restant > etape.secondes / 2 ? 'Côté droit' : 'Côté gauche') : null;
  // Segments de la barre : une couleur par phase
  const phases = seance.phases.filter((ph) => ph.items.length);
  const indexPhase = phases.findIndex((ph) => ph.phase === etape.phase);

  return (
    <div className={`ecran live ${enCours ? 'en-cours' : ''}`}>
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Quitter la séance" onClick={quitter}><Fermer /></button>
        <span className="sous">{terminee ? 'Séance terminée' : `${etape.phase} · ${index + 1}/${etapes.length}`}</span>
        <span className="cale" />
      </header>

      <div className="live-progression" aria-label={`Séance : ${mmss(ecoule)} sur ${mmss(total)}`}>
        <div className="live-segments">
          {phases.map((ph, i) => (
            <span key={ph.phase} className={i < indexPhase || terminee ? 'fait' : i === indexPhase ? 'actuel' : ''}
              style={{ flexGrow: ph.items.length ? etapes.filter((e) => e.phase === ph.phase).reduce((s, e) => s + e.secondes, 0) : 0 }} />
          ))}
        </div>
        <div className="live-temps"><span>{mmss(ecoule)}</span><span>−{mmss(total - ecoule)}</span></div>
      </div>

      {terminee ? (
        <section className="live-fin">
          <div className="arche grande"><Picto famille="Relaxation" taille={120} /></div>
          <h1>Namasté</h1>
          <p className="sous">Séance terminée · {mmss(total)}</p>
          <button type="button" className="principal" onClick={onQuitter}>Revenir à la séance</button>
        </section>
      ) : (
        <>
          <section className="live-centre">
            <div className="live-cercle">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r={rayon} className="fond-cercle" />
                <circle cx="100" cy="100" r={rayon} className="avance-cercle"
                  strokeDasharray={circonference} strokeDashoffset={circonference * (1 - fraction)} />
              </svg>
              <div className="live-picto"><Picto famille={etape.posture.famille} taille={92} /></div>
            </div>
            <div className="live-chrono" role="timer" aria-live="off">{mmss(restant)}</div>
            {cote && <p className="live-cote" key={cote}>{cote}</p>}
            <h1 className="live-nom" key={etape.id + index}>{nom(etape.posture)}</h1>
            <p className="sous">{[nomSecondaire(etape.posture), etape.duree].filter(Boolean).join(' · ')}</p>
            {etape.note && <p className="live-note">{etape.note}</p>}
          </section>

          <section className="live-resume-bloc">
            <Resume posture={etape.posture} fiche={fiches[etape.id]} />
          </section>

          <section className="live-ensuite">
            {suivante ? (
              <>
                <span className="etiquette">Ensuite{suivante.phase !== etape.phase ? ` · ${suivante.phase}` : ''}</span>
                <div className="live-suivante">
                  <Picto famille={suivante.posture.famille} taille={40} />
                  <span className="ligne-texte">
                    <span className="ligne-nom">{nom(suivante.posture)}</span>
                    <span className="ligne-infos">{suivante.duree || mmss(suivante.secondes)}</span>
                  </span>
                </div>
              </>
            ) : <span className="etiquette">Dernière posture</span>}
          </section>

          <div className="ressort" />

          <footer className="live-commandes">
            <button type="button" className="rond" aria-label="Posture précédente" onClick={precedent}><Precedent /></button>
            <button type="button" className="live-lecture" aria-label={enCours ? 'Pause' : 'Lancer'} onClick={basculer}>
              {enCours ? <Pause /> : <Lecture />}
            </button>
            <button type="button" className="rond" aria-label="Posture suivante" onClick={suivant}><Suivant /></button>
            <button type="button" className="live-plus" onClick={() => ajouter(30)}>+30 s</button>
          </footer>
        </>
      )}
    </div>
  );
}
