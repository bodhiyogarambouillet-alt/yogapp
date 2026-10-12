import { useEffect, useState } from 'react';

// Écran d'attente pendant la composition : le logo au trait (soleil levant), qui respire, et des messages qui défilent
const MESSAGES = [
  'Choix des postures…',
  'Équilibrage des phases…',
  'Préparation de la posture cible…',
  'Placement des contre-postures…',
  'Dernières vérifications…',
];
// Même tracé que le logo de l'en-tête (Icones.jsx, viewBox 28)
const RAYONS = ['M14 5v3', 'M6.4 8.4l1.3 1.3', 'M21.6 8.4l-1.3 1.3', 'M3.1 14.9l-1.8-.8', 'M24.9 14.9l1.8-.8'];

export default function ChargementSeance() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="chargement-seance" role="status" aria-live="polite">
      <svg className="chargement-soleil" viewBox="0 0 28 28" aria-hidden="true">
        {RAYONS.map((d, k) => <path key={k} className="chargement-rayon" d={d} style={{ animationDelay: `${k * 0.18}s` }} />)}
        <path className="chargement-astre" d="M4 20a10 10 0 0 1 20 0" />
        <path className="chargement-horizon" d="M2 24h24" />
      </svg>
      <p className="chargement-titre">Composition de votre séance</p>
      <p key={i} className="chargement-message">{MESSAGES[i]}</p>
    </div>
  );
}
