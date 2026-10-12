import { SILHOUETTES } from '../pictos-donnees.js';

// Pictogrammes des 16 familles de postures : silhouette pleine sur disque sable (tracés vectorisés).
export default function Picto({ famille, taille = 44 }) {
  return (
    <div className="picto" role="img" aria-label={`Pictogramme : ${famille}`} style={{ width: taille, height: taille }}>
      <svg width={taille} height={taille} viewBox="0 0 150 150" aria-hidden="true">
        <circle className="picto-disque" cx="75" cy="75" r="62" />
        <path d={SILHOUETTES[famille] || SILHOUETTES['Debout']} fill="currentColor" fillRule="evenodd" />
      </svg>
    </div>
  );
}
