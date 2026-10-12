import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Écran d'attente pendant la composition :
// le soleil du logo se lève derrière l'horizon, ses rayons se dessinent, des halos s'élargissent en onde,
// une barre de progression avance et les étapes se cochent au fil du temps.
const ETAPES = [
  'Choix des postures',
  'Équilibrage des phases',
  'Préparation et posture cible',
  'Placement des contre-postures',
  'Dernières vérifications',
];
const DUREE_ETAPE = 2800; // ms par étape affichée (la dernière reste active jusqu'à la fin)
// Même tracé que le logo de l'en-tête (Icones.jsx, viewBox 28)
const RAYONS = ['M14 7.8V5.8', 'M20.82 9.89L21.94 8.23', 'M7.18 9.89L6.06 8.23', 'M25.31 15.43L27.17 14.68', 'M2.69 15.43L.83 14.68'];

// Le soleil du décor (parcours de création) vient se placer sur celui de l'écran de chargement :
// on mesure les deux cercles et on anime le passage de l'un à l'autre (position et taille).
function departDuDecor() {
  const astre = document.querySelector('.fond-astre');
  if (!astre) return null;
  const r = astre.getBoundingClientRect();
  if (!r.width) return null;
  // cercle du décor : rayon 58 dans un repère 200 × 200, centré
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, diametre: (r.width * 116) / 200 };
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
    // cercle de l'écran de chargement : centre (14, 20) et rayon 10 dans un repère 28 × 28
    const arrivee = { x: r.left + (r.width * 14) / 28, y: r.top + (r.height * 20) / 28, diametre: (r.width * 20) / 28 };
    const dx = depart.current.x - arrivee.x;
    const dy = depart.current.y - arrivee.y;
    const echelle = depart.current.diametre / arrivee.diametre;
    const animation = el.animate(
      [
        // départ : couleur sable du décor ; arrivée : terracotta de l'écran de chargement
        { transform: `translate(${dx}px, ${dy}px) scale(${echelle})`, stroke: getComputedStyle(document.documentElement).getPropertyValue('--soleil').trim() || '#E3C9A8' },
        { transform: 'none', stroke: getComputedStyle(el).stroke },
      ],
      { duration: 1000, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
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
        <svg ref={soleil} className="chargement-soleil" viewBox="0 0 28 28" aria-hidden="true">
          <defs>
            <clipPath id="au-dessus-horizon"><rect x="-10" y="-10" width="48" height="34" /></clipPath>
          </defs>
          <g clipPath="url(#au-dessus-horizon)">
            {[0, 1, 2].map((k) => (
              <circle key={k} className="chargement-halo" cx="14" cy="20" r="10" style={{ animationDelay: `${1.2 + k * 1.1}s` }} />
            ))}
            <g className="chargement-lever">
              <path className="chargement-astre" d="M4 20a10 10 0 0 1 20 0" pathLength="1" />
              {RAYONS.map((d, k) => (
                <path key={k} className="chargement-rayon" d={d} pathLength="1" style={{ animationDelay: `${0.9 + k * 0.12}s, ${1.8 + k * 0.18}s` }} />
              ))}
            </g>
          </g>
          <path className="chargement-horizon" d="M2 24h24" pathLength="1" />
        </svg>
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
