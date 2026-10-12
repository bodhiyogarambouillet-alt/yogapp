import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { Dialogues } from './components/Dialogue.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Dialogues />
  </React.StrictMode>,
);
