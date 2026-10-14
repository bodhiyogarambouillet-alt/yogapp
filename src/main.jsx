import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { Dialogues } from './components/Dialogue.jsx';
import './styles.css';

// Écran d'ouverture (index.html) : visible au moins 1,6 s depuis le lancement. Sur l'accueil, ses cercles glissent
// et grandissent jusqu'au décor (demi-cercles depuis le bord gauche), puis le contenu apparaît ; ailleurs, simple fondu.
const ouverture = document.getElementById('ouverture');
if (ouverture) {
  const terminer = () => {
    document.documentElement.classList.remove('ouverture');
    ouverture.classList.add('sortie');
    setTimeout(() => ouverture.remove(), 800);
  };
  const fermer = () => {
    const logo = ouverture.querySelector('.ouverture-logo');
    const groupe = document.querySelector('.fond-ondes.accueil .fond-groupe');
    const arc = groupe?.querySelector('.fond-demi.n1');
    const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!logo || !groupe || !arc || calme) { terminer(); return; }
    // Centre et rayon du grand cercle du décor (son centre est sur le bord gauche de l'écran)
    const g = groupe.getBoundingClientRect();
    const rayon = (arc.offsetHeight / 2) * (new DOMMatrix(getComputedStyle(groupe).transform).a || 1);
    const l = logo.getBoundingClientRect();
    const dx = g.left - (l.left + l.width / 2);
    const dy = g.top - (l.top + l.height / 2);
    const echelle = rayon / (l.width / 2);
    // L'accueil n'apparaît que lorsque les cercles sont arrivés (fin réelle du mouvement, pas un délai fixe :
    // sur téléphone, le mouvement peut démarrer avec un peu de retard)
    let fini = false;
    const arrivee = () => {
      if (fini) return;
      fini = true;
      document.documentElement.classList.remove('ouverture');
      ouverture.remove();
    };
    logo.addEventListener('transitionend', (e) => { if (e.target === logo && e.propertyName === 'transform') arrivee(); });
    setTimeout(arrivee, 2500); // filet de sécurité si la fin du mouvement n'est pas signalée
    ouverture.classList.add('vers-accueil');
    logo.style.transition = 'transform 1.1s cubic-bezier(0.65, 0, 0.35, 1) 0.15s';
    requestAnimationFrame(() => requestAnimationFrame(() => { logo.style.transform = `translate(${dx}px, ${dy}px) scale(${echelle})`; }));
  };
  Promise.race([document.fonts?.ready, new Promise((ok) => setTimeout(ok, 2500))])
    .then(() => setTimeout(fermer, Math.max(0, 1600 - performance.now())));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Dialogues />
  </React.StrictMode>,
);
