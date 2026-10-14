import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { Dialogues } from './components/Dialogue.jsx';
import './styles.css';

// Écran d'ouverture (index.html) : visible au moins 1,6 s depuis le lancement, puis fondu vers l'accueil
const ouverture = document.getElementById('ouverture');
if (ouverture) {
  const fermer = () => {
    ouverture.classList.add('sortie');
    setTimeout(() => ouverture.remove(), 800);
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
