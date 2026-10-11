import { useId, useState } from 'react';
import { rechercherPostures, NIVEAU_MAX, nom, nomSecondaire } from '../bibliotheque.js';
import Picto from './Picto.jsx';

// Champ « Posture cible » : recherche dans la bibliothèque, une seule posture sélectionnable.
export default function ChoixCible({ cible, onChange, style, niveau }) {
  const [texte, setTexte] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const idListe = useId();
  const resultats = rechercherPostures(texte, style);

  const choisir = (p) => {
    onChange(p);
    setTexte('');
    setOuvert(false);
  };

  if (cible) {
    const auDessus = cible.niveau > (NIVEAU_MAX[niveau] ?? 1);
    const horsStyle = !cible.styles.includes(style);
    return (
      <div className="cible-choisie">
        <div className="cible-carte">
          <Picto famille={cible.famille} taille={44} />
          <span className="ligne-texte">
            <span className="ligne-nom">{nom(cible)}</span>
            <span className="ligne-infos">{[nomSecondaire(cible), `niveau ${cible.niveau}`, cible.famille].filter(Boolean).join(' · ')}</span>
          </span>
          <button type="button" className="rond nu" aria-label={`Retirer la posture cible ${nom(cible)}`} onClick={() => onChange(null)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <p className="aide">La séance sera une progression qui amène à cette posture en fin de pratique active, suivie de sa contre-posture.</p>
        {cible.zones?.length > 0 && <p className="aide"><strong>Zones à préparer :</strong> {cible.zones.join(', ')}</p>}
        {cible.preparations?.length > 0 && <p className="aide"><strong>Préparations :</strong> {cible.preparations.join(' → ')}</p>}
        {!cible.preparations?.length && <p className="aide alerte-texte">Aucune préparation renseignée dans votre bibliothèque : la progression s'appuiera seulement sur les zones.</p>}
        {auDessus && <p className="aide alerte-texte">Niveau {cible.niveau}, au-dessus du niveau {niveau} : une variante facilitée sera proposée.</p>}
        {!auDessus && horsStyle && <p className="aide alerte-texte">Posture non cochée pour le style {style} dans votre bibliothèque.</p>}
      </div>
    );
  }

  return (
    <div className="cible-recherche">
      <input
        id="cible" type="search" autoComplete="off" value={texte}
        placeholder="Ex. : corbeau, roue, Natarajasana…"
        role="combobox" aria-expanded={ouvert && resultats.length > 0} aria-controls={idListe}
        onChange={(e) => { setTexte(e.target.value); setOuvert(true); }}
        onFocus={() => setOuvert(true)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (resultats[0]) choisir(resultats[0]); } }}
      />
      {ouvert && resultats.length > 0 && (
        <ul className="suggestions" id={idListe} role="listbox">
          {resultats.map((p) => (
            <li key={p.id} role="option" aria-selected="false">
              <button type="button" onClick={() => choisir(p)}>
                <Picto famille={p.famille} taille={36} />
                <span className="ligne-texte">
                  <span className="ligne-nom">{nom(p)}</span>
                  <span className="ligne-infos">{[nomSecondaire(p), `niveau ${p.niveau}`, p.styles.includes(style) ? null : 'hors style'].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {ouvert && texte.trim().length >= 2 && resultats.length === 0 && <p className="aide">Aucune posture trouvée dans la bibliothèque.</p>}
    </div>
  );
}
