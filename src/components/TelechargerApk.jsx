import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { estNatif } from '../natif.js';

// Sur ordinateur : proposer l'appli Android (APK hébergé dans le stockage Supabase, publié par `npm run apk:publier`).
// Un QR code à scanner avec le téléphone, ou le téléchargement direct du fichier.
const BASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const URL_APK = BASE ? `${BASE}/storage/v1/object/public/applis/mes-seances-yoga.apk` : null;
const URL_INFO = BASE ? `${BASE}/storage/v1/object/public/applis/apk.json` : null;

function useGrandEcran() {
  const [grand, setGrand] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)');
    const maj = () => setGrand(m.matches);
    m.addEventListener('change', maj);
    return () => m.removeEventListener('change', maj);
  }, []);
  return grand;
}

export default function TelechargerApk() {
  const grand = useGrandEcran();
  const [info, setInfo] = useState(null); // { maj, taille }
  useEffect(() => {
    if (!URL_INFO || estNatif) return;
    fetch(URL_INFO, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then(setInfo).catch(() => {});
  }, []);
  const qr = useMemo(() => {
    if (!URL_APK) return '';
    const q = qrcode(0, 'M');
    q.addData(URL_APK);
    q.make();
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }).replace(/fill="#000000"/g, 'fill="#2E2622"').replace(/fill="#ffffff"/gi, 'fill="transparent"');
  }, []);

  if (!URL_APK || estNatif || !grand) return null;
  const details = info
    ? `${(info.taille / 1048576).toFixed(1)} Mo · mise à jour le ${new Date(info.maj).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
    : 'Pour téléphone Android';
  return (
    <aside className="apk" aria-label="Application Android">
      {/* QR généré localement à partir de l'adresse de l'APK : contenu sûr */}
      <div className="apk-qr" role="img" aria-label="QR code de téléchargement de l'appli Android" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="apk-texte">
        <strong>L'appli Android</strong>
        <span>Scannez avec votre téléphone, ou téléchargez le fichier.</span>
        <span className="apk-details">{details}</span>
        <a className="lien" href={URL_APK} download="mes-seances-yoga.apk">Télécharger l'APK</a>
      </div>
    </aside>
  );
}
