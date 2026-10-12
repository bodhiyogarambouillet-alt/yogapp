import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Écran d'attente pendant la composition : les ronds concentriques du logo ondulent du cœur vers l'extérieur,
// des ondes s'en échappent en continu et une onde plus marquée part à chaque étape cochée ;
// une barre de progression avance et les étapes se cochent au fil du temps.
const ETAPES = [
  'Choix des postures',
  'Équilibrage des phases',
  'Préparation et posture cible',
  'Placement des contre-postures',
  'Dernières vérifications',
];
const DUREE_ETAPE = 2800; // ms par étape affichée (la dernière reste active jusqu'à la fin)
// Ronds du logo (Icones.jsx) : rayons 12.5, 9, 5.5 et 2.5 sur 12.5
const RONDS = [1, 0.72, 0.44, 0.2];

// Le cœur du décor (parcours de création) vient se placer sur celui de l'écran de chargement, entraînant tous les ronds :
// on mesure les deux cercles et on anime le passage de l'un à l'autre (position et taille).
function departDuDecor() {
  const coeur = document.querySelector('.fond-coeur');
  if (!coeur) return null;
  const r = coeur.getBoundingClientRect();
  if (!r.width) return null;
  // demi-disque centré sur le bord gauche : centre au milieu de son bord gauche, diamètre = sa hauteur
  return { x: r.left, y: r.top + r.height / 2, diametre: r.height };
}

export default function ChargementSeance() {
  const [ecoule, setEcoule] = useState(0);
  const soleil = useRef(null);

  const depart = useRef(departDuDecor()); // mesuré au premier rendu, avant que le décor ne s'efface
  useLayoutEffect(() => {
    const el = soleil.current;
    if (!depart.current || !el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    el.getAnimations().forEach((a) => a.cancel()); // mesure sur la position finale, sans animation en cours
    const r = el.getBoundingClientRect();
    // cœur de l'écran de chargement : au centre des ronds, 20 % de leur diamètre
    const arrivee = { x: r.left + r.width / 2, y: r.top + r.height / 2, diametre: r.width * RONDS[RONDS.length - 1] };
    const dx = depart.current.x - arrivee.x;
    const dy = depart.current.y - arrivee.y;
    const echelle = depart.current.diametre / arrivee.diametre;
    const animation = el.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${echelle})` }, { transform: 'none' }],
      { duration: 1100, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    return () => animation.cancel();
  }, []);
  useEffect(() => {
    const debut = Date.now();
    const t = setInterval(() => setEcoule(Date.now() - debut), 120);
    return () => clearInterval(t);
  }, []);

  const etapeActive = Math.min(ETAPES.length - 1, Math.floor(ecoule / DUREE_ETAPE));
  // Progression qui ralentit en approchant de la fin, sans jamais l'atteindre avant la réponse
  const progression = Math.min(94, 100 * (1 - Math.exp(-ecoule / 9000)));

  return (
    <div className={`chargement-seance ${depart.current ? 'depuis-decor' : ''}`} role="status" aria-live="polite" aria-label="Composition de votre séance">
      <div className="chargement-scene">
        <div ref={soleil} className="chargement-ronds" aria-hidden="true">
          {RONDS.map((r, i) => (
            <span key={r} className={`chargement-rond n${i + 1}`} style={{ '--r': r, animationDelay: `${(RONDS.length - 1 - i) * 0.2}s` }} />
          ))}
          {[0, 1.2].map((d) => <span key={d} className="chargement-onde" style={{ animationDelay: `${d}s` }} />)}
          <span key={etapeActive} className="chargement-goutte" />
        </div>
      </div>

      <p className="chargement-titre">Composition de votre séance</p>

      <div className="chargement-barre" aria-hidden="true">
        <span style={{ width: `${progression}%` }} />
      </div>

      <ol className="chargement-etapes">
        {ETAPES.map((libelle, k) => {
          const etat = k < etapeActive ? 'faite' : k === etapeActive ? 'en-cours' : 'a-venir';
          return (
            <li key={libelle} className={etat}>
              <span className="chargement-puce" aria-hidden="true">
                {etat === 'faite' && <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg>}
              </span>
              <span>{libelle}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
