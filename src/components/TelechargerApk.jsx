import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { estNatif } from '../natif.js';

// Sur ordinateur (barre du haut) : proposer l'appli Android (APK hébergé dans le stockage Supabase, publié par `npm run apk:publier`).
// Un QR code à scanner avec le téléphone, ou le téléchargement direct du fichier.
const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const URL_APK = BASE ? `${BASE}/storage/v1/object/public/applis/mes-seances-yoga.apk` : null;
const URL_INFO = BASE ? `${BASE}/storage/v1/object/public/applis/apk.json` : null;

// Tête du robot Android (au trait)
const Android = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 18a8 8 0 0 1 16 0z" /><path d="M8.3 11.1L6.6 8.4" /><path d="M15.7 11.1l1.7-2.7" />
    <circle cx="9" cy="14.6" r="0.9" fill="currentColor" stroke="none" /><circle cx="15" cy="14.6" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

// Bouton Android de la barre du haut (ordinateur) : au clic, la carte de téléchargement avec QR code
export default function TelechargerApk() {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);
  const [info, setInfo] = useState(null); // { maj, taille }
  useEffect(() => {
    if (!ouvert || info || !URL_INFO) return;
    fetch(URL_INFO, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setInfo).catch(() => {});
  }, [ouvert, info]);
  // Fermeture : clic à côté ou touche Échap
  useEffect(() => {
    if (!ouvert) return undefined;
    const clic = (e) => { if (!zone.current?.contains(e.target)) setOuvert(false); };
    const touche = (e) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('pointerdown', clic);
    document.addEventListener('keydown', touche);
    return () => { document.removeEventListener('pointerdown', clic); document.removeEventListener('keydown', touche); };
  }, [ouvert]);
  const qr = useMemo(() => {
    if (!URL_APK) return '';
    const q = qrcode(0, 'M');
    q.addData(URL_APK);
    q.make();
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }).replace(/fill="#000000"/g, 'fill="#2E2622"').replace(/fill="#ffffff"/gi, 'fill="transparent"');
  }, []);

  if (!URL_APK || estNatif) return null;
  const details = info
    ? `${(info.taille / 1048576).toFixed(1)} Mo · mise à jour le ${new Date(info.maj).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
    : 'Pour téléphone Android';
  return (
    <div className="apk-zone" ref={zone}>
      <button type="button" className={`apk-bouton ${ouvert ? 'actif' : ''}`} aria-label="Appli Android" aria-expanded={ouvert} title="Appli Android"
        onClick={() => setOuvert(!ouvert)}><Android /></button>
      {ouvert && (
        <div className="apk" role="dialog" aria-label="Télécharger l'appli Android">
          {/* QR généré localement à partir de l'adresse de l'APK : contenu sûr */}
          <div className="apk-qr" role="img" aria-label="QR code de téléchargement de l'appli Android" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="apk-texte">
            <strong>L'appli Android</strong>
            <span>Scannez avec votre téléphone, ou téléchargez le fichier.</span>
            <span className="apk-details">{details}</span>
            <a className="lien" href={URL_APK} download="mes-seances-yoga.apk">Télécharger l'APK</a>
          </div>
        </div>
      )}
    </div>
  );
}
