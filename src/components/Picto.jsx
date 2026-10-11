// Pictogrammes de famille (16), même tracé que la maquette.

const TRACES = {
  'Respiration': <><path d="M3.5 8H13q4 0 3.5-3.5" /><path d="M3.5 12H20" /><path d="M3.5 16H13q4 0 3.5 3.5" /></>,
  'Mobilisation': <><path d="M2.5 19.5H21.5" /><circle cx="5" cy="13.5" r="1.6" /><path d="M7 12q5-5.5 10 0" /><path d="M7.5 12.5V19.5" /><path d="M17 12v7.5h3" /></>,
  'Assise': <><circle cx="12" cy="4.5" r="1.8" /><path d="M12 6.5V14" /><path d="M12 9.5L8 14" /><path d="M12 9.5L16 14" /><path d="M4.5 18.5Q12 13 19.5 18.5" /><path d="M6.5 20H17.5" /></>,
  'Debout': <><circle cx="12" cy="3.5" r="1.8" /><path d="M12 5.5V13" /><path d="M4.5 8.5H19.5" /><path d="M12 13L6.5 20.5" /><path d="M12 13l4.5 3v4.5" /><path d="M3 21H21" /></>,
  'Équilibre': <><circle cx="12" cy="5" r="1.6" /><path d="M12 7V14" /><path d="M12 8.5L8.5 3.5" /><path d="M12 8.5L15.5 3.5" /><path d="M12 14V21" /><path d="M12 14l3.5 2-3.5 1.8" /></>,
  'Équilibre sur les bras': <><path d="M3.5 19H20.5" /><circle cx="6.5" cy="11" r="1.5" /><path d="M8.5 11Q12 7 16 9.5" /><path d="M11 10.2V19" /><path d="M14 9.5V19" /><path d="M16 9.5l-3 3.5 3.5 1" /></>,
  'Gainage': <><path d="M2 19.5H22" /><circle cx="4.5" cy="10.5" r="1.6" /><path d="M6.3 11.5L20.5 18" /><path d="M7.8 12.2V19.5" /><path d="M20.5 18l1 1.5" /></>,
  'Flexion avant': <><path d="M13.5 21V12" /><path d="M13.5 12Q9 11.5 9.5 16.5" /><circle cx="9.5" cy="18.6" r="1.5" /><path d="M11.2 13L11 20.5" /><path d="M8 21H17" /></>,
  'Flexion latérale': <><path d="M8 21l4-8 4 8" /><path d="M12 13q0-5 4-7.5" /><circle cx="17.5" cy="4" r="1.6" /><path d="M13.3 8.5Q14.5 3 19.5 2.5" /><path d="M12.4 10.5L9 13" /></>,
  'Extension': <><path d="M2.5 19.5H21.5" /><path d="M21 19H11" /><path d="M11 19Q7 18 6.5 12" /><circle cx="7" cy="9.4" r="1.6" /><path d="M7.5 14L8.5 19" /></>,
  'Torsion': <><circle cx="10" cy="5" r="1.7" /><path d="M10 7v12" /><path d="M10 10l5.5 4" /><path d="M10 10l-4 5" /><path d="M10 19l4.5-5 1.5 5" /><path d="M4 19.5H20" /></>,
  'Ouverture de hanches': <><circle cx="12" cy="4.5" r="1.7" /><path d="M12 6.5V15" /><path d="M12 15L4.5 17.5 11 19.5" /><path d="M12 15l7.5 2.5-6.5 2" /><path d="M12 9.5L10.5 18" /><path d="M12 9.5l1.5 8.5" /></>,
  'Inversion': <><path d="M2.5 19.5H21.5" /><path d="M4 19l7.5-12L20 19" /><circle cx="6.6" cy="15.6" r="1.5" /></>,
  'Allongée': <><path d="M2 20H22" /><circle cx="4.5" cy="17" r="1.6" /><path d="M6.3 17.5H14" /><path d="M14 17.5l2.5-5 3 2.5" /><path d="M9 17.5l5.5-4" /></>,
  'Enchaînement': <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 3.5V8h-4.5" /><circle cx="12" cy="9" r="1.5" /><path d="M12 10.5V14" /><path d="M9.5 12L12 11l2.5 1" /><path d="M12 14l-2 2.5" /><path d="M12 14l2 2.5" /></>,
  'Relaxation': <><path d="M2 19.5H22" /><circle cx="4" cy="16.8" r="1.6" /><path d="M5.8 17H21" /><path d="M8.5 17.2L10 19" /><path d="M9 10.5q1.5-1.5 3 0t3 0 3 0" /></>,
};

export default function Picto({ famille, taille = 44 }) {
  const icone = Math.round(taille * 0.62);
  return (
    <div
      className="picto"
      role="img"
      aria-label={`Pictogramme : ${famille}`}
      style={{ width: taille, height: taille, borderRadius: Math.round(taille * 0.3) }}
    >
      <svg width={icone} height={icone} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {TRACES[famille] || TRACES['Debout']}
      </svg>
    </div>
  );
}
