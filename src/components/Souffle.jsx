import { useEffect, useState } from 'react';

// Respiration guidée : un disque qui s'ouvre à l'inspiration et se referme à l'expiration, au rythme choisi.
// Le rythme choisi est gardé sur l'appareil.

export const RYTHMES = [
  { id: '4-4', nom: '4 · 4', aide: 'Souffle régulier', temps: [['Inspirez', 4, 1], ['Expirez', 4, 0]] },
  { id: '5-5', nom: 'Cohérence', aide: '5 s · 5 s', temps: [['Inspirez', 5, 1], ['Expirez', 5, 0]] },
  { id: '4-7-8', nom: '4 · 7 · 8', aide: 'Apaisant', temps: [['Inspirez', 4, 1], ['Retenez', 7, 1], ['Expirez', 8, 0]] },
  { id: 'carre', nom: 'Carré', aide: '4 · 4 · 4 · 4', temps: [['Inspirez', 4, 1], ['Retenez', 4, 1], ['Expirez', 4, 0], ['Poumons vides', 4, 0]] },
];

const CLE = 'yoga:rythme-souffle';
export const rythmeMemorise = () => { try { return localStorage.getItem(CLE) || '4-4'; } catch { return '4-4'; } };
export const memoriserRythme = (id) => { try { localStorage.setItem(CLE, id); } catch { /* stockage indisponible */ } };

// Disque animé, placé au centre du cercle du minuteur ; il s'arrête quand la séance est en pause
export function DisqueSouffle({ rythme, enCours }) {
  const r = RYTHMES.find((x) => x.id === rythme) || RYTHMES[0];
  const [pas, setPas] = useState({ i: 0, reste: r.temps[0][1] });
  useEffect(() => { setPas({ i: 0, reste: r.temps[0][1] }); }, [r]);
  useEffect(() => {
    if (!enCours) return undefined;
    const t = setInterval(() => setPas(({ i, reste }) => {
      if (reste > 1) return { i, reste: reste - 1 };
      const j = (i + 1) % r.temps.length;
      return { i: j, reste: r.temps[j][1] };
    }), 1000);
    return () => clearInterval(t);
  }, [enCours, r]);
  const [libelle, duree, ouvert] = r.temps[pas.i];
  // La transition dure tout le temps de l'étape : le disque s'ouvre (ou se referme) en continu
  return (
    <div className={`souffle ${enCours ? '' : 'pause'}`} aria-live="polite">
      <span className="souffle-disque" style={{ transform: `scale(${enCours && ouvert ? 1 : 0.5})`, transitionDuration: `${enCours ? duree : 0.4}s` }} />
      <span className="souffle-texte">
        <strong>{enCours ? libelle : 'En pause'}</strong>
        {enCours && <span>{pas.reste}</span>}
      </span>
    </div>
  );
}

// Choix du rythme, sous le nom de la posture
export function ChoixRythme({ rythme, onChoisir, onFermer }) {
  return (
    <div className="souffle-choix" role="group" aria-label="Rythme de la respiration guidée">
      {RYTHMES.map((x) => (
        <button type="button" key={x.id} className={`badge choix ${x.id === rythme ? 'actif' : ''}`} aria-pressed={x.id === rythme}
          title={x.aide} onClick={() => onChoisir(x.id)}>{x.nom}</button>
      ))}
      <button type="button" className="badge choix" onClick={onFermer} aria-label="Arrêter la respiration guidée">✕</button>
    </div>
  );
}
