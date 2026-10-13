import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Picto from './Picto.jsx';
import { nom, nomSecondaire, variantesDe } from '../bibliotheque.js';
import { Fermer, Lecture, Pause, Suivant, Precedent, Attention, Agrandir, Reduire } from './Icones.jsx';
import { DisqueSouffle, ChoixRythme, rythmeMemorise, memoriserRythme } from './Souffle.jsx';
import { obtenirFiche } from '../stockage.js';
import { useRetour, vibrer } from '../natif.js';
import { useMusiqueLive, CarteMorceau } from './MusiqueLive.jsx';
import { confirmer } from './Dialogue.jsx';
import { NIVEAUX_VOIX, niveauVoix, dernierNiveauVoix, enregistrerNiveauVoix, parler, taire, segmentsAnnonce, preparerVoix, PHRASES_FIXES, contexteAudio, savasanaGuide, textesSavasana, planSavasana, estRelaxationFinale } from '../voix.js';

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
  // Résumé dédié (3 consignes + souffle en bref) ; à défaut, les premiers repères et la respiration de la fiche
  const reperes = fiche?.resume?.length ? fiche.resume : (fiche?.alignement || []).slice(0, 3);
  const souffle = fiche?.souffle_court || fiche?.respiration;
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
          {reperes.length > 0 && <ul className="live-reperes">{reperes.map((r, i) => <li key={i}>{r}</li>)}</ul>}
          {souffle && <p className="live-souffle"><strong>Souffle :</strong> {souffle}</p>}
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

// Mode cours en salle : consignes de la fiche en défilement vertical continu (comme un prompteur),
// en pause avec la séance ; pas de défilement si tout tient dans le cadre
function ConsignesDefilantes({ posture, fiche, enCours }) {
  const cadre = useRef(null);
  const bloc = useRef(null);
  const [defile, setDefile] = useState(false);
  const sections = fiche ? [
    ['Installation', fiche.entree, 'ol'],
    ['Repères', fiche.alignement?.length ? fiche.alignement : fiche.resume, 'ul'],
    ['Dans la posture', fiche.tenue, 'ul'],
    ['Souffle', fiche.respiration || fiche.souffle_court, 'p'],
  ].filter(([, v]) => (Array.isArray(v) ? v.length : v)) : [];
  if (posture.precautions) sections.push(['Précautions', posture.precautions, 'p']);
  const nbLignes = sections.reduce((n, [, v]) => n + (Array.isArray(v) ? v.length : 2), 0);
  useEffect(() => {
    const mesurer = () => setDefile(Boolean(bloc.current && cadre.current && bloc.current.offsetHeight > cadre.current.clientHeight));
    mesurer();
    const obs = new ResizeObserver(mesurer);
    if (cadre.current) obs.observe(cadre.current);
    return () => obs.disconnect();
  }, [fiche, posture.id]);
  if (fiche === undefined) return <div className="consignes-defilantes"><p className="aide">Chargement des consignes…</p></div>;
  if (!sections.length) return null;
  const contenu = (cache) => (
    <div className="consignes-bloc" ref={cache ? undefined : bloc} aria-hidden={cache || undefined}>
      {sections.map(([titre, v, balise]) => (
        <section key={titre}>
          <h3>{titre}</h3>
          {balise === 'p' ? <p>{v}</p> : balise === 'ol'
            ? <ol>{v.map((t, i) => <li key={i}>{t}</li>)}</ol>
            : <ul>{v.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        </section>
      ))}
    </div>
  );
  // Le contenu est doublé pour boucler sans à-coup ; la vitesse dépend de la longueur (environ 5 s par ligne)
  return (
    <div className={`consignes-defilantes ${defile ? 'defile' : ''}`} ref={cadre} key={posture.id}>
      <div className="consignes-piste" style={{ animationDuration: `${Math.max(30, nbLignes * 5)}s`, animationPlayState: enCours ? 'running' : 'paused' }}>
        {contenu(false)}
        {defile && contenu(true)}
      </div>
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
  const activer = useCallback(() => { ctx.current = contexteAudio(); }, []);
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
  const [coteGauche, setCoteGauche] = useState(false); // passé au côté gauche (ne revient pas en arrière avec « +30 s »)
  const { activer, sonner } = useSignal();
  const { fiches, charger } = useFiches(seance);
  useEcranAllume(enCours);
  const musique = useMusiqueLive(seance.playlist, enCours, terminee);
  // Voix guide : coupée à l'ouverture, activée d'un toucher
  const [voix, setVoix] = useState(niveauVoix);
  const voixRef = useRef(voix);
  voixRef.current = voix;
  const [bulleVoix, setBulleVoix] = useState(null); // rappel du niveau choisi, affiché brièvement
  const annoncee = useRef(-1);
  const [preparation, setPreparation] = useState(null); // { fait, total } pendant la préparation de la voix naturelle
  const voixEnPreparation = Boolean(preparation && preparation.fait < preparation.total);

  const etape = etapes[index];
  const suivante = etapes[index + 1];

  // Respiration guidée : ouverte d'office sur les postures de respiration, à la demande sur les autres
  const [souffle, setSouffle] = useState(null); // rythme en cours, ou null
  useEffect(() => { setSouffle(etape?.posture.famille === 'Respiration' ? rythmeMemorise() : null); }, [etape?.id, index]); // eslint-disable-line react-hooks/exhaustive-deps
  const choisirRythme = (id) => { memoriserRythme(id); setSouffle(id); };

  // Mode cours en salle : grand affichage plein écran, lisible de loin (tablette, vidéoprojecteur)
  const [salle, setSalle] = useState(false);
  const basculerSalle = () => {
    const suivant = !salle;
    setSalle(suivant);
    try {
      if (suivant) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch { /* plein écran indisponible : le grand affichage suffit */ }
  };
  useEffect(() => {
    const sortie = () => { if (!document.fullscreenElement) setSalle(false); };
    document.addEventListener('fullscreenchange', sortie);
    return () => {
      document.removeEventListener('fullscreenchange', sortie);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Savasana accompagné : pendant la relaxation finale, la voix guide la détente puis le retour
  const savasana = useMemo(() => (estRelaxationFinale(etape) && savasanaGuide() ? planSavasana(etape.secondes) : []), [etape]);
  const savasanaDit = useRef(0); // nombre de textes déjà dits pour la posture en cours
  useEffect(() => { savasanaDit.current = 0; }, [index]);

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
      if (voixRef.current !== 'non') parler(PHRASES_FIXES.fin);
      return;
    }
    const j = Math.max(0, i);
    setIndex(j);
    setRestant(etapes[j].secondes);
    coteSignale.current = false;
    setCoteGauche(false);
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
      // Savasana accompagné : chaque texte à son moment (une pause décale tout, puisque le temps écoulé s'arrête)
      const ecouleEtape = etape.secondes - r;
      while (savasana[savasanaDit.current] && ecouleEtape >= savasana[savasanaDit.current].t) {
        const { texte } = savasana[savasanaDit.current++];
        if (voixRef.current !== 'non') parler(texte);
      }
      // Posture des deux côtés : signal à mi-parcours
      if (etape.posture.cotes && !coteSignale.current && r <= etape.secondes / 2) {
        coteSignale.current = true;
        setCoteGauche(true);
        sonner(740, 1);
        vibrer(120);
        if (voixRef.current !== 'non') parler(PHRASES_FIXES.changer);
      }
      setRestant(r);
    }, 250);
    return () => clearInterval(tic);
  }, [enCours, index, etape, etapes, allerA, sonner, savasana]);

  // Annonce de chaque nouvelle posture pendant que la séance tourne ; pause ou sortie : la voix se tait
  useEffect(() => {
    if (!enCours) { taire(); return; }
    if (voix === 'non' || annoncee.current === index || !etape) return;
    annoncee.current = index;
    const precedente = etapes[index - 1];
    parler(segmentsAnnonce({ etape, nouvellePhase: !precedente || precedente.phase !== etape.phase }));
  }, [enCours, index, etape, etapes, voix]);
  useEffect(() => () => taire(), []);

  // Voix naturelle : à l'activation, on prépare toutes les annonces de la séance (déjà générées pour la plupart)
  const textesVoix = useMemo(() => (voix === 'non' ? [] : [
    ...etapes.flatMap((e, i) => segmentsAnnonce({ etape: e, nouvellePhase: i === 0 || etapes[i - 1].phase !== e.phase })),
    PHRASES_FIXES.changer, PHRASES_FIXES.fin,
    ...(savasanaGuide() && etapes.some(estRelaxationFinale) ? textesSavasana() : []),
  ]), [etapes, voix]);
  useEffect(() => {
    if (voix === 'non') return;
    preparerVoix(textesVoix, setPreparation).finally(() => setTimeout(() => setPreparation(null), 1200));
  }, [voix, textesVoix]);

  const changerVoix = () => {
    // Coupée ↔ activée
    const i = NIVEAUX_VOIX.findIndex(([n]) => n === voix);
    const [suivant, libelle] = voix === 'non'
      ? NIVEAUX_VOIX.find(([n]) => n === dernierNiveauVoix()) || NIVEAUX_VOIX[1]
      : NIVEAUX_VOIX[(i + 1) % NIVEAUX_VOIX.length];
    setVoix(suivant);
    enregistrerNiveauVoix(suivant);
    setBulleVoix(libelle);
    setTimeout(() => setBulleVoix((b) => (b === libelle ? null : b)), 1800);
    if (suivant === 'non') taire();
    else if (enCours) { annoncee.current = -1; } // annonce tout de suite la posture en cours
  };

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

  const quitter = async () => {
    if (enCours && !(await confirmer({
      titre: 'Arrêter la séance en cours ?', message: 'Le minuteur s’arrête et vous revenez au déroulé de la séance.',
      ok: 'Arrêter', annuler: 'Continuer', danger: true,
    }))) return;
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
  const cote = etape.posture.cotes ? (coteGauche ? 'Côté gauche' : 'Côté droit · puis gauche') : null;
  // Segments de la barre : une couleur par phase
  const phases = seance.phases.filter((ph) => ph.items.length);
  const indexPhase = phases.findIndex((ph) => ph.phase === etape.phase);

  return (
    <div className={`ecran live ${enCours ? 'en-cours' : ''} ${salle ? 'salle' : ''}`}>
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Quitter la séance" onClick={quitter}><Fermer /></button>
        <span className="sous">{bulleVoix
          || (preparation && preparation.fait < preparation.total ? `Préparation de la voix… ${preparation.fait}/${preparation.total}` : null)
          || (terminee ? 'Séance terminée' : `${etape.phase} · ${index + 1}/${etapes.length}`)}</span>
        <span className="live-actions">
        <button type="button" className="rond salle-bouton" onClick={basculerSalle} aria-pressed={salle}
          aria-label={salle ? 'Quitter le mode cours en salle' : 'Mode cours en salle (grand écran)'}>{salle ? <Reduire /> : <Agrandir />}</button>
        {/* Pendant la préparation de la voix : ondes qui s'allument tour à tour et anneau qui se remplit */}
        <button type="button" className={`rond voix-bouton ${voix !== 'non' ? 'actif' : ''} ${voixEnPreparation ? 'prepare' : ''}`} onClick={changerVoix}
          style={voixEnPreparation ? { '--avance': `${Math.round((preparation.fait / preparation.total) * 100)}%` } : undefined}
          aria-label={`${NIVEAUX_VOIX.find(([n]) => n === voix)?.[1]}${voixEnPreparation ? ', préparation en cours' : ''} (toucher pour changer)`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
            {voix === 'non' ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path className="voix-onde o1" d="M15.5 9a4 4 0 0 1 0 6" />}
            {voix !== 'non' && <path className="voix-onde o2" d="M18.3 6.5a7.5 7.5 0 0 1 0 11" />}
          </svg>
        </button>
        </span>
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
              {souffle
                ? <DisqueSouffle rythme={souffle} enCours={enCours} />
                : <div className="live-picto"><Picto famille={etape.posture.famille} taille={92} /></div>}
            </div>
            <div className="live-infos">
            <div className="live-chrono" role="timer" aria-live="off">{mmss(restant)}</div>
            {cote && <p className="live-cote" key={cote}>{cote}</p>}
            <h1 className="live-nom" key={etape.id + index}>{nom(etape.posture)}</h1>
            <p className="sous">{[nomSecondaire(etape.posture), etape.duree].filter(Boolean).join(' · ')}</p>
            {etape.note && <p className="live-note">{etape.note}</p>}
            {variantesDe(etape).length > 0 && (
              <p className="live-variantes"><strong>Variantes :</strong> {variantesDe(etape).map(nom).join(' · ')}</p>
            )}
            {salle && <ConsignesDefilantes posture={etape.posture} fiche={fiches[etape.id]} enCours={enCours} />}
            {souffle
              ? <ChoixRythme rythme={souffle} onChoisir={choisirRythme} onFermer={() => setSouffle(null)} />
              : <button type="button" className="souffle-lancer" onClick={() => setSouffle(rythmeMemorise())}>Respiration guidée</button>}
            {salle && (
              <p className="salle-ensuite">{suivante
                ? <><span>Ensuite</span> {nom(suivante.posture)} · {suivante.duree || mmss(suivante.secondes)}</>
                : <span>Dernière posture</span>}</p>
            )}
            </div>
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

          <CarteMorceau musique={musique} playlist={seance.playlist} />

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
