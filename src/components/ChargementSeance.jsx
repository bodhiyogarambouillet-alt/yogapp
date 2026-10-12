import { useEffect, useState } from 'react';

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
const RAYONS = ['M14 7.8V5.6', 'M22.63 11.37l1.55-1.55', 'M5.37 11.37L3.82 9.82', 'M25.06 14.84l1.99-.93', 'M2.94 14.84l-1.99-.93'];

export default function ChargementSeance() {
  const [ecoule, setEcoule] = useState(0);
  useEffect(() => {
    const debut = Date.now();
    const t = setInterval(() => setEcoule(Date.now() - debut), 120);
    return () => clearInterval(t);
  }, []);

  const etapeActive = Math.min(ETAPES.length - 1, Math.floor(ecoule / DUREE_ETAPE));
  // Progression qui ralentit en approchant de la fin, sans jamais l'atteindre avant la réponse
  const progression = Math.min(94, 100 * (1 - Math.exp(-ecoule / 9000)));

  return (
    <div className="chargement-seance" role="status" aria-live="polite" aria-label="Composition de votre séance">
      <div className="chargement-scene">
        <svg className="chargement-soleil" viewBox="0 0 28 28" aria-hidden="true">
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
