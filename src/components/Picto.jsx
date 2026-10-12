// Pictogrammes des 16 familles de postures : illustrations (WebP 256 px, fond transparent, disque inclus).
import respiration from '../assets/pictos/respiration.webp';
import mobilisation from '../assets/pictos/mobilisation.webp';
import assise from '../assets/pictos/assise.webp';
import debout from '../assets/pictos/debout.webp';
import equilibre from '../assets/pictos/equilibre.webp';
import equilibreBras from '../assets/pictos/equilibre-sur-bras.webp';
import gainage from '../assets/pictos/gainage.webp';
import flexionAvant from '../assets/pictos/flexion-avant.webp';
import flexionLaterale from '../assets/pictos/flexion-laterale.webp';
import extension from '../assets/pictos/extension.webp';
import torsion from '../assets/pictos/torsion.webp';
import hanches from '../assets/pictos/ouverture-des-hanches.webp';
import inversion from '../assets/pictos/inversion.webp';
import allongee from '../assets/pictos/allongee.webp';
import enchainement from '../assets/pictos/enchainement.webp';
import relaxation from '../assets/pictos/relaxation.webp';

const IMAGES = {
  'Respiration': respiration,
  'Mobilisation': mobilisation,
  'Assise': assise,
  'Debout': debout,
  'Équilibre': equilibre,
  'Équilibre sur les bras': equilibreBras,
  'Gainage': gainage,
  'Flexion avant': flexionAvant,
  'Flexion latérale': flexionLaterale,
  'Extension': extension,
  'Torsion': torsion,
  'Ouverture de hanches': hanches,
  'Inversion': inversion,
  'Allongée': allongee,
  'Enchaînement': enchainement,
  'Relaxation': relaxation,
};

export default function Picto({ famille, taille = 44 }) {
  return (
    <div className="picto" style={{ width: taille, height: taille }}>
      <img src={IMAGES[famille] || IMAGES['Debout']} alt={`Pictogramme : ${famille}`} width={taille} height={taille} loading="lazy" decoding="async" />
    </div>
  );
}
