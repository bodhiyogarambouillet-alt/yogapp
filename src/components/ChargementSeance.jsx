import { useEffect, useState } from 'react';

// Écran d'attente pendant la composition de la séance : un soleil qui respire et des messages qui défilent
const MESSAGES = [
  'Choix des postures…',
  'Équilibrage des phases…',
  'Préparation de la posture cible…',
  'Placement des contre-postures…',
  'Dernières vérifications…',
];
const RAYONS = [[16, 9.5, 16, 6], [23.4, 12, 25.5, 9.3], [8.6, 12, 6.5, 9.3], [27.3, 17.4, 29.6, 16.5], [4.7, 17.4, 2.4, 16.5]];

export default function ChargementSeance() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="chargement-seance" role="status" aria-live="polite">
      <svg className="chargement-soleil" viewBox="0 0 32 32" aria-hidden="true">
        <g className="chargement-rayons">
          {RAYONS.map(([x1, y1, x2, y2], k) => (
            <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} style={{ animationDelay: `${k * 0.18}s` }} />
          ))}
        </g>
        <path className="chargement-astre" d="M7.5 21.5a8.5 8.5 0 0 1 17 0z" />
        <rect className="chargement-horizon" x="4" y="23" width="24" height="2.8" rx="1.4" />
      </svg>
      <p className="chargement-titre">Composition de votre séance</p>
      <p key={i} className="chargement-message">{MESSAGES[i]}</p>
    </div>
  );
}
