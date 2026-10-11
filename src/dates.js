// Date prévue de la séance (« AAAA-MM-JJ »), distincte de la date d'enregistrement.

export const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Séances enregistrées avant l'ajout de la date : on reprend le jour d'enregistrement
export const dateDe = (seance) => seance.dateSeance || (seance.enregistreeLe ? seance.enregistreeLe.slice(0, 10) : null);

export const dateLisible = (iso) => (iso
  ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  : '');
