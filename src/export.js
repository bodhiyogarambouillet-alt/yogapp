// Export d'une séance en texte, PDF ou image.
// Site : téléchargement (ou partage si le navigateur le propose). Appli Android : fichier partagé
// via le menu de partage du téléphone (enregistrer, envoyer, imprimer…), car window.print n'y fonctionne pas.

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { nom, nomSecondaire, PAR_ID, variantesDe } from './bibliotheque.js';
import { dateDe, dateLisible } from './dates.js';
import { estNatif } from './natif.js';

// ---------- Contenu commun ----------

function contenu(seance) {
  const cible = seance.cibleId ? PAR_ID.get(seance.cibleId) : null;
  const total = seance.phases.reduce((s, ph) => s + ph.minutes, 0);
  const date = dateLisible(dateDe(seance));
  return {
    titre: cible ? `Objectif : ${nom(cible)}` : seance.titre || seance.style,
    infos: [seance.style, seance.niveau, `${total} min`].filter(Boolean).join(' · '),
    date: date ? date.charAt(0).toUpperCase() + date.slice(1) : '',
    intention: seance.intention || '',
    phases: seance.phases.filter((ph) => ph.items.length).map((ph) => ({
      titre: `${ph.phase} — ${ph.minutes} min`,
      postures: ph.items.map((it) => ({
        nom: [nom(it.posture), nomSecondaire(it.posture) ? `(${nomSecondaire(it.posture)})` : null].filter(Boolean).join(' '),
        duree: [it.duree, it.posture.cotes ? 'droite + gauche' : null].filter(Boolean).join(', '),
        note: [it.note, variantesDe(it).length ? `Variantes : ${variantesDe(it).map(nom).join(', ')}` : null].filter(Boolean).join(' — '),
      })),
    })),
  };
}

const nomFichier = (seance, extension) => {
  const base = `seance-${(seance.style || 'yoga').toLowerCase()}-${dateDe(seance) || 'sans-date'}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
  return `${base}.${extension}`;
};

// ---------- Texte ----------

export function texteSeance(seance) {
  const c = contenu(seance);
  const lignes = [c.titre, c.infos, c.date, c.intention ? `\n${c.intention}` : ''].filter((l) => l !== '');
  for (const ph of c.phases) {
    lignes.push('', ph.titre.toUpperCase());
    for (const p of ph.postures) {
      lignes.push(`• ${p.nom}${p.duree ? ` — ${p.duree}` : ''}`);
      if (p.note) lignes.push(`  ${p.note}`);
    }
  }
  return lignes.join('\n');
}

// ---------- PDF ----------

// Les polices standard du PDF ne couvrent pas certains signes typographiques
const pourPdf = (t) => t.replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[′]/g, "'").replace(/→/g, '->')
  .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/[–—]/g, '-').replace(/ /g, ' ');

export async function pdfSeance(seance) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const c = contenu(seance);
  const marge = 18;
  const largeur = 210 - marge * 2;
  let y = 22;
  const ecrire = (texte, { taille = 11, gras = false, couleur = [46, 38, 34], retrait = 0, apres = 1.5 } = {}) => {
    doc.setFont('helvetica', gras ? 'bold' : 'normal').setFontSize(taille).setTextColor(...couleur);
    const lignes = doc.splitTextToSize(pourPdf(texte), largeur - retrait);
    const hauteur = taille * 0.42;
    for (const l of lignes) {
      if (y + hauteur > 297 - marge) { doc.addPage(); y = marge + 4; }
      doc.text(l, marge + retrait, y);
      y += hauteur;
    }
    y += apres;
  };
  ecrire(c.titre, { taille: 20, gras: true, couleur: [169, 71, 42], apres: 2 });
  ecrire(c.infos, { taille: 11, couleur: [107, 94, 85], apres: 0.5 });
  if (c.date) ecrire(c.date, { taille: 11, couleur: [107, 94, 85] });
  if (c.intention) { y += 2; ecrire(c.intention, { taille: 11 }); }
  for (const ph of c.phases) {
    y += 4;
    ecrire(ph.titre, { taille: 13, gras: true, couleur: [169, 71, 42], apres: 2 });
    for (const p of ph.postures) {
      ecrire(`- ${p.nom}${p.duree ? `  (${p.duree})` : ''}`, { taille: 11, gras: true, retrait: 2, apres: p.note ? 0.5 : 1.5 });
      if (p.note) ecrire(p.note, { taille: 10, couleur: [107, 94, 85], retrait: 6 });
    }
  }
  return doc.output('blob');
}

// ---------- Image (PNG) ----------

export async function imageSeance(seance) {
  await document.fonts?.ready;
  const c = contenu(seance);
  const L = 1080;
  const marge = 72;
  const largeur = L - marge * 2;
  const COUL = { fond: '#F3ECE1', carte: '#FBF7F1', texte: '#2E2622', doux: '#6B5E55', accent: '#A9472A' };
  const POLICE_TITRE = "'Marcellus', Georgia, serif";
  const POLICE = "'Karla', system-ui, sans-serif";

  // Découpe en lignes selon la largeur disponible
  const mesure = document.createElement('canvas').getContext('2d');
  const couper = (texte, police, max) => {
    mesure.font = police;
    const lignes = [];
    let ligne = '';
    for (const mot of texte.split(/\s+/)) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (mesure.measureText(essai).width > max && ligne) { lignes.push(ligne); ligne = mot; } else ligne = essai;
    }
    if (ligne) lignes.push(ligne);
    return lignes;
  };

  // Liste des éléments à dessiner, puis hauteur totale
  const blocs = [];
  const ajouter = (texte, police, couleur, hauteurLigne, { retrait = 0, apres = 0, dans = false } = {}) => {
    for (const l of couper(texte, police, largeur - retrait - (dans ? 64 : 0))) blocs.push({ l, police, couleur, h: hauteurLigne, retrait, dans });
    if (apres) blocs.push({ espace: apres, dans });
  };
  ajouter(c.titre, `64px ${POLICE_TITRE}`, COUL.accent, 76, { apres: 8 });
  ajouter(c.infos, `600 30px ${POLICE}`, COUL.doux, 42);
  if (c.date) ajouter(c.date, `30px ${POLICE}`, COUL.doux, 42);
  if (c.intention) { blocs.push({ espace: 18 }); ajouter(c.intention, `italic 30px ${POLICE}`, COUL.texte, 42); }
  for (const ph of c.phases) {
    blocs.push({ espace: 40, debutCarte: true }, { espace: 20 }); // espace avant la carte, puis marge intérieure
    ajouter(ph.titre, `40px ${POLICE_TITRE}`, COUL.accent, 56, { apres: 6, dans: true });
    for (const p of ph.postures) {
      ajouter(p.nom, `700 32px ${POLICE}`, COUL.texte, 44, { dans: true });
      ajouter([p.duree, p.note].filter(Boolean).join(' · '), `28px ${POLICE}`, COUL.doux, 38, { apres: 14, dans: true });
    }
    blocs.push({ espace: 20, finCarte: true });
  }
  const hauteur = marge * 2 + blocs.reduce((s, b) => s + (b.espace || b.h), 0);

  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = hauteur;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COUL.fond;
  ctx.fillRect(0, 0, L, hauteur);

  // 1er passage : fonds des cartes de phase ; 2e passage : textes
  let y = marge;
  let debut = null;
  for (const b of blocs) {
    if (b.debutCarte) { y += b.espace; debut = y; continue; }
    if (b.finCarte) {
      y += b.espace;
      ctx.fillStyle = COUL.carte;
      ctx.beginPath();
      ctx.roundRect(marge, debut, largeur, y - debut, 32);
      ctx.fill();
      continue;
    }
    y += b.espace || b.h;
  }
  y = marge;
  ctx.textBaseline = 'alphabetic';
  for (const b of blocs) {
    if (b.debutCarte) { y += b.espace; continue; }
    if (b.espace) { y += b.espace; continue; }
    y += b.h;
    ctx.font = b.police;
    ctx.fillStyle = b.couleur;
    ctx.fillText(b.l, marge + b.retrait + (b.dans ? 32 : 0), y - b.h * 0.25);
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// ---------- Envoi du fichier ----------

const enBase64 = (blob) => new Promise((resolve, reject) => {
  const lecteur = new FileReader();
  lecteur.onload = () => resolve(String(lecteur.result).split(',')[1]);
  lecteur.onerror = reject;
  lecteur.readAsDataURL(blob);
});

function telecharger(blob, nomF) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomF;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function partagerFichier(blob, nomF, titre) {
  if (estNatif) {
    const { uri } = await Filesystem.writeFile({ path: nomF, data: await enBase64(blob), directory: Directory.Cache });
    await Share.share({ title: titre, files: [uri], dialogTitle: 'Exporter la séance' });
    return;
  }
  const fichier = new File([blob], nomF, { type: blob.type });
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ title: titre, files: [fichier] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  telecharger(blob, nomF);
}

// format : 'texte' | 'pdf' | 'image'
export async function exporterSeance(seance, format) {
  const titre = contenu(seance).titre;
  if (format === 'texte') {
    const texte = texteSeance(seance);
    if (estNatif) { await Share.share({ title: titre, text: texte, dialogTitle: 'Exporter la séance' }); return; }
    return partagerFichier(new Blob([texte], { type: 'text/plain;charset=utf-8' }), nomFichier(seance, 'txt'), titre);
  }
  if (format === 'pdf') return partagerFichier(await pdfSeance(seance), nomFichier(seance, 'pdf'), titre);
  return partagerFichier(await imageSeance(seance), nomFichier(seance, 'png'), titre);
}
