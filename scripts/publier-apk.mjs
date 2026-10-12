// Publie l'APK Android dans le stockage Supabase (bucket public « applis »), pour le proposer au téléchargement
// depuis le site sur ordinateur. Lancer après `npm run android:apk` : npm run apk:publier
import { readFileSync, statSync } from 'node:fs';
import { stockage, urlPublique, supabaseConfigure } from './supabase-admin.mjs';

const BUCKET = 'applis';
const FICHIER = 'android/app/build/outputs/apk/debug/app-debug.apk';
const NOM = 'mes-seances-yoga.apk';

if (!supabaseConfigure) throw new Error('Supabase non configuré (.env.local)');

// Bucket public (lecture seule pour tous ; l'écriture reste réservée à la clé secrète)
try {
  await stockage('bucket', {
    method: 'POST',
    entetes: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 50 * 1024 * 1024 }),
  });
  console.log(`Bucket « ${BUCKET} » créé`);
} catch (e) {
  if (!/already exists|Duplicate/i.test(e.texte || '')) throw e;
}

const apk = readFileSync(FICHIER);
await stockage(`object/${BUCKET}/${NOM}`, {
  method: 'POST',
  body: apk,
  entetes: { 'Content-Type': 'application/vnd.android.package-archive', 'x-upsert': 'true', 'cache-control': 'max-age=60' },
});
// Petite fiche de version : date et taille affichées sur le site
const info = { maj: statSync(FICHIER).mtime.toISOString(), taille: apk.length };
await stockage(`object/${BUCKET}/apk.json`, {
  method: 'POST',
  body: JSON.stringify(info),
  entetes: { 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'max-age=60' },
});
console.log(`APK publié (${(apk.length / 1048576).toFixed(1)} Mo) : ${urlPublique(BUCKET, NOM)}`);
