// Fonctions propres à l'appli Android (Capacitor) ; sur le site, repli sur les API du navigateur.
import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics } from '@capacitor/haptics';

export const estNatif = Capacitor.isNativePlatform();

// Vibration courte (la WebView Android ignore navigator.vibrate : on passe par le plugin)
export function vibrer(ms = 200) {
  try {
    if (estNatif) Haptics.vibrate({ duration: ms }).catch(() => {});
    else navigator.vibrate?.(ms);
  } catch { /* vibration indisponible */ }
}

// ---------- Bouton « retour » d'Android ----------
// Chaque écran ou état (menu ouvert, mode édition, séance en direct…) déclare ce que fait « retour »,
// avec une priorité : la plus haute l'emporte (à égalité, la plus récente). Sans gestionnaire : l'appli passe en arrière-plan.
const gestionnaires = [];
let compteur = 0;

if (estNatif) {
  App.addListener('backButton', () => {
    const actif = gestionnaires.reduce((a, g) => (!a || g.priorite > a.priorite || (g.priorite === a.priorite && g.ordre > a.ordre) ? g : a), null);
    if (actif) actif.ref.current();
    else App.minimizeApp();
  });
}

export function useRetour(actif, fn, priorite = 0) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!actif || !estNatif) return undefined;
    const g = { ref, priorite, ordre: ++compteur };
    gestionnaires.push(g);
    return () => gestionnaires.splice(gestionnaires.indexOf(g), 1);
  }, [actif, priorite]);
}
