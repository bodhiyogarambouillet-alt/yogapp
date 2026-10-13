import { useState } from 'react';
import { PAR_ID, bilanZones, variantes, variantesDe, dureeParDefaut, nom, nomSecondaire, rechercherPostures } from '../bibliotheque.js';
import { stylesDe } from '../styles-seance.js';
import Picto from './Picto.jsx';
import { dateDe } from '../dates.js';
import Live from './Live.jsx';
import Musique from './Musique.jsx';
import { useRetour } from '../natif.js';
import { Retour, Remplacer, Attention, Valide, Points, Exporter, Etincelle, Fermer, Lecture } from './Icones.jsx';
import { exporterSeance } from '../export.js';
import { alerter } from './Dialogue.jsx';
import { horsLigne, telechargerVoix, segmentsAnnonce, PHRASES_FIXES, savasanaGuide, textesSavasana } from '../voix.js';
import { obtenirFiche } from '../stockage.js';

// Durées plus compactes dans la liste (le détail reste dans la fiche)
const court = (d) => (d || '').replace(/respirations?/i, 'resp.').replace(/droite \+ gauche/i, 'D + G');

const ROLES = { cible: 'Posture cible', preparation: 'Préparation', contre: 'Contre-posture' };

// Ajout d'une posture dans une phase (mode édition)
function AjoutPosture({ seance, onAjouter, onFermer }) {
  const [texte, setTexte] = useState('');
  const resultats = rechercherPostures(texte, stylesDe(seance), 8, true);
  return (
    <div className="ajout-posture">
      <input type="search" autoFocus autoComplete="off" value={texte} onChange={(e) => setTexte(e.target.value)}
        placeholder="Rechercher une posture…" aria-label="Rechercher une posture à ajouter" />
      {resultats.length > 0 && (
        <ul className="suggestions">
          {resultats.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onAjouter(p)}>
                <Picto famille={p.famille} taille={36} />
                <span className="ligne-texte">
                  <span className="ligne-nom">{nom(p)}</span>
                  <span className="ligne-infos">{[nomSecondaire(p), `niveau ${p.niveau}`].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {texte.trim().length >= 2 && resultats.length === 0 && <p className="aide">Aucune posture trouvée.</p>}
      <button type="button" className="lien" onClick={onFermer}>Annuler</button>
    </div>
  );
}

// Variantes d'une posture : la remplacer par l'une d'elles, ou les proposer en complément (cours multi-niveaux)
function FeuilleVariantes({ item, seance, onRemplacer, onBasculer, onFermer }) {
  const liste = variantes(item.posture, seance);
  const choisies = item.variantes || [];
  return (
    <div className="voile" onClick={onFermer}>
      <div className="feuille feuille-variantes" role="dialog" aria-label={`Variantes de ${nom(item.posture)}`} onClick={(e) => e.stopPropagation()}>
        <h2>Variantes de {nom(item.posture)}</h2>
        <p className="aide"><strong>Proposer en option</strong> : la posture reste, la variante est suggérée aux élèves (cours multi-niveaux).
          {item.role !== 'cible' && <> <strong>Remplacer la posture</strong> : la variante prend sa place.</>}</p>
        <div className="variantes-liste">
          {liste.length === 0 && <p className="aide">Aucune variante adaptée à cette séance.</p>}
          {liste.map((p) => {
            const ajoutee = choisies.includes(p.id);
            return (
              <div key={p.id} className="variante">
                <Picto famille={p.famille} taille={36} />
                <span className="ligne-texte">
                  <span className="ligne-nom">{nom(p)}</span>
                  <span className="ligne-infos">{[nomSecondaire(p), `niveau ${p.niveau}`, p.accessoires?.toLowerCase()].filter(Boolean).join(' · ')}</span>
                </span>
                <div className="variante-actions">
                  <button type="button" className={`badge choix ${ajoutee ? 'actif' : ''}`} aria-pressed={ajoutee} onClick={() => onBasculer(p)}>
                    {ajoutee ? '✓ Proposée en option' : 'Proposer en option'}
                  </button>
                  {item.role !== 'cible' && <button type="button" className="badge choix" onClick={() => onRemplacer(p)}>Remplacer la posture</button>}
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" className="principal" onClick={onFermer}>Terminer</button>
      </div>
    </div>
  );
}

// Rendre la séance disponible hors connexion : fiches de ses postures et voix du guide gardées sur l'appareil
function HorsLigne({ seance }) {
  const [etat, setEtat] = useState(() => horsLigne(seance.uid));
  const [progres, setProgres] = useState(null); // { texte, fait, total }
  const telecharger = async () => {
    if (!navigator.onLine) { alerter({ titre: 'Pas de connexion', message: 'Connectez-vous à internet pour préparer la séance hors connexion.' }); return; }
    // Fiches des postures, pour les relire sans connexion
    const ids = [...new Set(seance.phases.flatMap((ph) => ph.items.map((it) => it.id)))];
    for (const [k, id] of ids.entries()) {
      setProgres({ texte: 'Fiches', fait: k, total: ids.length });
      try { await obtenirFiche(id, seance); } catch { /* fiche indisponible */ }
    }
    // Toutes les annonces de la voix guide
    const textes = [];
    let precedente = null;
    seance.phases.forEach((ph) => ph.items.forEach((it) => {
      textes.push(...segmentsAnnonce({ etape: { ...it, phase: ph.phase }, nouvellePhase: precedente !== ph.phase }));
      precedente = ph.phase;
    }));
    textes.push(PHRASES_FIXES.changer, PHRASES_FIXES.fin);
    if (savasanaGuide() && seance.phases.some((ph) => ph.phase === 'Relaxation' && ph.items.length)) textes.push(...textesSavasana());
    setProgres({ texte: 'Voix', fait: 0, total: textes.length });
    const { manquants } = await telechargerVoix(seance.uid, textes, (p) => setProgres({ texte: 'Voix', ...p }));
    setEtat(horsLigne(seance.uid));
    setProgres(null);
    if (manquants) alerter({ titre: 'Presque prêt', message: `${manquants} annonce${manquants > 1 ? 's' : ''} n'ont pas pu être téléchargées : la voix du téléphone les dira. Réessayez avec une meilleure connexion.` });
  };
  return (
    <button type="button" className={`hors-ligne ${etat ? 'pret' : ''}`} onClick={telecharger} disabled={Boolean(progres)}>
      <span className="hors-ligne-icone" aria-hidden="true">{etat ? '✓' : '⤓'}</span>
      <span className="hors-ligne-texte">
        <strong>{progres ? `${progres.texte}… ${progres.fait}/${progres.total}` : etat ? 'Disponible hors connexion' : 'Rendre disponible hors connexion'}</strong>
        <span>{progres ? 'Téléchargement des fiches et des voix' : etat ? `Fiches et voix sur cet appareil · toucher pour mettre à jour` : 'Fiches et voix du guide gardées sur cet appareil'}</span>
      </span>
      {progres && <span className="hors-ligne-barre" style={{ '--avance': `${Math.round((progres.fait / Math.max(1, progres.total)) * 100)}%` }} />}
    </button>
  );
}

export default function Seance({ seance, onChange, onRetour, onRegenerer, onEnregistrer, onOuvrirPosture, enregistree, chargement }) {
  const [menu, setMenu] = useState(false);
  const [remplacement, setRemplacement] = useState(false);
  const [live, setLive] = useState(false); // déroulé en direct, avec minuteur
  const [edition, setEdition] = useState(false); // modifier la séance : ordre, durées, notes, ajouts, suppressions
  const [ajoutPhase, setAjoutPhase] = useState(null); // index de la phase où l'on ajoute une posture
  const [exportOuvert, setExportOuvert] = useState(false); // choix du format d'export
  const [exportEnCours, setExportEnCours] = useState(null); // format en cours de préparation
  const [variantesOuvertes, setVariantesOuvertes] = useState(null); // [phase, posture] dont on choisit les variantes

  const nbPostures = seance.phases.reduce((s, ph) => s + ph.items.length, 0);
  const total = seance.phases.reduce((s, ph) => s + ph.minutes, 0);
  const cible = seance.cibleId ? PAR_ID.get(seance.cibleId) : null;
  const bilan = bilanZones(seance);
  // Posture mise en avant dans l'arche : la cible, sinon la dernière posture du pic
  const pic = seance.phases.find((ph) => ph.phase === 'Pic');
  const vedette = cible || pic?.items.at(-1)?.posture || seance.phases.flatMap((ph) => ph.items).at(0)?.posture;
  // (pas d'article devant le nom : « le Roue » serait faux, d'où « Objectif » en surtitre)
  const titre = cible ? nom(cible) : seance.titre || seance.style;

  // Remplacer par une variante : les autres variantes choisies sont gardées
  const remplacer = (iPhase, iItem, p) => {
    majItem(iPhase, iItem, {
      id: p.id, posture: p, duree: dureeParDefaut(p), note: undefined,
      variantes: (seance.phases[iPhase].items[iItem].variantes || []).filter((v) => v !== p.id),
    });
    setVariantesOuvertes(null);
  };
  const basculerVariante = (iPhase, iItem, p) => {
    const actuelles = seance.phases[iPhase].items[iItem].variantes || [];
    const suivantes = actuelles.includes(p.id) ? actuelles.filter((v) => v !== p.id) : [...actuelles, p.id];
    majItem(iPhase, iItem, { variantes: suivantes.length ? suivantes : undefined });
  };

  const action = (fn) => () => { setMenu(false); fn(); };

  // Retour d'Android : ferme d'abord le menu, l'ajout de posture, puis les modes édition / remplacement
  useRetour(!live && (menu || edition || remplacement || exportOuvert || variantesOuvertes), () => {
    if (variantesOuvertes) setVariantesOuvertes(null);
    else if (exportOuvert) setExportOuvert(false);
    else if (menu) setMenu(false);
    else if (ajoutPhase !== null) setAjoutPhase(null);
    else { setEdition(false); setRemplacement(false); }
  }, 1);

  // ---------- Édition ----------
  const majPhase = (iPhase, fn) => onChange({ ...seance, phases: seance.phases.map((ph, i) => (i === iPhase ? fn(ph) : ph)) });
  const majItem = (iPhase, iItem, champs) =>
    majPhase(iPhase, (ph) => ({ ...ph, items: ph.items.map((it, j) => (j === iItem ? { ...it, ...champs } : it)) }));
  const supprimerItem = (iPhase, iItem) => majPhase(iPhase, (ph) => ({ ...ph, items: ph.items.filter((_, j) => j !== iItem) }));
  // Déplacer d'un cran ; en bout de phase, la posture passe dans la phase voisine
  const deplacer = (iPhase, iItem, sens) => {
    const phases = seance.phases.map((ph) => ({ ...ph, items: [...ph.items] }));
    const items = phases[iPhase].items;
    const cibleIndex = iItem + sens;
    if (cibleIndex >= 0 && cibleIndex < items.length) {
      [items[iItem], items[cibleIndex]] = [items[cibleIndex], items[iItem]];
    } else {
      const voisine = phases[iPhase + sens];
      if (!voisine) return;
      const [it] = items.splice(iItem, 1);
      if (sens < 0) voisine.items.push(it); else voisine.items.unshift(it);
    }
    onChange({ ...seance, phases });
  };
  const ajouter = (iPhase, p) => {
    majPhase(iPhase, (ph) => ({ ...ph, items: [...ph.items, { id: p.id, posture: p, duree: dureeParDefaut(p) }] }));
    setAjoutPhase(null);
  };
  const changerMinutes = (iPhase, valeur) => majPhase(iPhase, (ph) => ({ ...ph, minutes: Math.max(0, Math.min(180, Number(valeur) || 0)) }));

  if (live) {
    return <Live seance={seance} onQuitter={() => { setLive(false); window.scrollTo(0, 0); }} />;
  }

  return (
    <div className="ecran">
      <header className="entete compact">
        <button type="button" className="rond" aria-label="Retour au formulaire" onClick={onRetour}><Retour /></button>
        <span className="sous">{seance.style} · {seance.niveau}</span>
        <button type="button" className="rond" aria-label="Plus d'actions" aria-expanded={menu} onClick={() => setMenu(!menu)}><Points /></button>
      </header>

      {menu && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={action(() => { setEdition(!edition); setRemplacement(false); setAjoutPhase(null); })}><Points /> {edition ? 'Terminer les modifications' : 'Modifier la séance'}</button>
          <button type="button" role="menuitem" onClick={action(() => { setRemplacement(!remplacement); setEdition(false); })}><Remplacer /> {remplacement ? 'Terminer les variantes' : 'Variantes et remplacements'}</button>
          <button type="button" role="menuitem" onClick={action(() => setExportOuvert(true))}><Exporter /> Exporter</button>
          <button type="button" role="menuitem" onClick={action(onRegenerer)} disabled={chargement}><Etincelle /> Autre version</button>
        </div>
      )}

      {exportOuvert && (
        <div className="voile" onClick={() => !exportEnCours && setExportOuvert(false)}>
          <div className="feuille" role="dialog" aria-label="Exporter la séance" onClick={(e) => e.stopPropagation()}>
            <h2>Exporter la séance</h2>
            {[['fiche', 'Fiche à imprimer', 'Une page A4 avec pictos, à poser au bord du tapis'], ['texte', 'Texte', 'À coller dans un message ou une note'], ['pdf', 'PDF', 'À imprimer ou à envoyer'], ['image', 'Image', 'Une image à partager']].map(([f, titre, aide]) => (
              <button type="button" key={f} className="choix-export" disabled={Boolean(exportEnCours)}
                onClick={async () => {
                  setExportEnCours(f);
                  try {
                    await exporterSeance(seance, f);
                    setExportOuvert(false);
                  } catch (e) {
                    alerter({ titre: 'Export impossible', message: e.message });
                  } finally {
                    setExportEnCours(null);
                  }
                }}>
                <strong>{exportEnCours === f ? 'Préparation…' : titre}</strong>
                <span>{aide}</span>
              </button>
            ))}
            <button type="button" className="lien" onClick={() => setExportOuvert(false)} disabled={Boolean(exportEnCours)}>Annuler</button>
          </div>
        </div>
      )}

      {variantesOuvertes && seance.phases[variantesOuvertes[0]]?.items[variantesOuvertes[1]] && (
        <FeuilleVariantes item={seance.phases[variantesOuvertes[0]].items[variantesOuvertes[1]]} seance={seance}
          onRemplacer={(p) => remplacer(variantesOuvertes[0], variantesOuvertes[1], p)}
          onBasculer={(p) => basculerVariante(variantesOuvertes[0], variantesOuvertes[1], p)}
          onFermer={() => setVariantesOuvertes(null)} />
      )}

      {/* Grand écran : informations de la séance à gauche, phases à droite */}
      <div className="seance-colonnes">
        <div className="seance-gauche">
        <section className="heros">
          {vedette && (
            <div className="arche moyenne"><Picto famille={vedette.famille} taille={80} /></div>
          )}
          <div>
            <div className="chiffre"><strong>{total}′</strong><span>{nbPostures} postures</span></div>
            {cible && <p className="surtitre">Objectif</p>}
            <h1>{titre}</h1>
          </div>
        </section>

        {seance.intention && <p className="intention seance-intention">{seance.intention}</p>}

        <button type="button" className="composer lancer" onClick={() => { setLive(true); window.scrollTo(0, 0); }}>
          <span>Lancer la séance</span>
          <Lecture />
        </button>

        <label className="date-seance">
          <span>Date de la séance</span>
          <input type="date" value={dateDe(seance) || ''} onChange={(e) => onChange({ ...seance, dateSeance: e.target.value || null })} />
        </label>

        <HorsLigne key={seance.uid} seance={seance} />

        <Musique seance={seance} onChange={onChange} />

        {bilan && bilan.manquantes.length === 0 && (
          <p className="bilan"><Valide /> {bilan.couvertes.join(', ')} : préparé{bilan.couvertes.length > 1 ? 's' : ''}</p>
        )}
        {bilan && bilan.manquantes.length > 0 && (
          <p className="bilan manque"><Attention /> Pas encore préparé : {bilan.manquantes.join(', ')}. Remplacez une posture ou demandez une autre version.</p>
        )}
        {seance.avertissement && <p className="avertissement"><Attention />{seance.avertissement}</p>}

        </div>
        <div className="seance-droite">
        {edition && (
          <div className="mode-remplacement mode-edition">
            <label className="edition-titre">
              <span>Titre</span>
              <input type="text" value={seance.titre || ''} onChange={(e) => onChange({ ...seance, titre: e.target.value })} />
            </label>
            <button type="button" className="principal" onClick={() => { setEdition(false); setAjoutPhase(null); }}>Terminer</button>
          </div>
        )}

        {remplacement && (
          <div className="mode-remplacement">
            <span>Touchez ⇄ pour remplacer une posture ou lui ajouter des variantes.</span>
            <button type="button" className="rond nu" aria-label="Terminer les variantes" onClick={() => setRemplacement(false)}><Fermer /></button>
          </div>
        )}

        <section className="phases">
          {seance.phases.map((ph, i) => (
            <article key={ph.phase} className={`phase ${ph.phase === 'Pic' && ph.items.length ? 'pic' : ''}`}>
              <div className="phase-tete">
                <h2>{ph.phase}</h2>
                {edition ? (
                  <label className="minutes edition-minutes">
                    <input type="number" inputMode="numeric" min="0" max="180" value={ph.minutes} aria-label={`Minutes de la phase ${ph.phase}`}
                      onChange={(e) => changerMinutes(i, e.target.value)} />′
                  </label>
                ) : <span className="minutes">{ph.minutes}′</span>}
              </div>
              {ph.items.length === 0 && <p className="vide">Aucune posture proposée pour cette phase.</p>}
              {ph.items.map((it, j) => (
                <div className={`ligne ${it.role === 'cible' ? 'ligne-cible' : ''}`} key={`${it.id}-${j}`}>
                  <button type="button" className="ligne-lien" onClick={() => !edition && onOuvrirPosture(it.posture)}>
                    <Picto famille={it.posture.famille} taille={38} />
                    <span className="ligne-texte">
                      {it.role && it.role !== 'cible' && <span className="role">{ROLES[it.role]}</span>}
                      <span className="ligne-nom">{nom(it.posture)}</span>
                      {it.note && <span className="ligne-note">{it.note}</span>}
                    </span>
                    <span className="duree-ligne">{court(it.duree)}</span>
                  </button>
                  {remplacement && (
                    <button type="button" className="rond nu" aria-label={`Variantes de ${nom(it.posture)}`} onClick={() => setVariantesOuvertes([i, j])}><Remplacer /></button>
                  )}
                  {variantesDe(it).length > 0 && (
                    <div className="ligne-variantes">
                      <span className="ligne-variantes-titre">Variantes</span>
                      {variantesDe(it).map((v) => (edition || remplacement ? (
                        <button type="button" key={v.id} className="variante-puce" aria-label={`Retirer la variante ${nom(v)}`} onClick={() => basculerVariante(i, j, v)}>
                          {nom(v)} <Fermer />
                        </button>
                      ) : (
                        <button type="button" key={v.id} className="variante-puce" onClick={() => onOuvrirPosture(v)}>{nom(v)}</button>
                      )))}
                    </div>
                  )}
                  {edition && (
                    <div className="edition-ligne">
                      <input type="text" className="edition-duree" value={it.duree || ''} aria-label={`Durée de ${nom(it.posture)}`}
                        placeholder="Durée" onChange={(e) => majItem(i, j, { duree: e.target.value })} />
                      <input type="text" className="edition-note" value={it.note || ''} aria-label={`Consigne pour ${nom(it.posture)}`}
                        placeholder="Consigne (facultatif)" onChange={(e) => majItem(i, j, { note: e.target.value || undefined })} />
                      <div className="edition-boutons">
                        <button type="button" className="rond nu" aria-label={`Variantes de ${nom(it.posture)}`} onClick={() => setVariantesOuvertes([i, j])}><Remplacer /></button>
                        <button type="button" className="rond nu" aria-label="Monter" disabled={i === 0 && j === 0} onClick={() => deplacer(i, j, -1)}>↑</button>
                        <button type="button" className="rond nu" aria-label="Descendre" disabled={i === seance.phases.length - 1 && j === ph.items.length - 1} onClick={() => deplacer(i, j, 1)}>↓</button>
                        <button type="button" className="rond nu" aria-label={`Retirer ${nom(it.posture)}`} onClick={() => supprimerItem(i, j)}><Fermer /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {edition && (ajoutPhase === i
                ? <AjoutPosture seance={seance} onAjouter={(p) => ajouter(i, p)} onFermer={() => setAjoutPhase(null)} />
                : <button type="button" className="lien ajouter" onClick={() => setAjoutPhase(i)}>+ Ajouter une posture</button>)}
            </article>
          ))}
        </section>

        <div className="ressort" />

        <footer className="pied deux">
          <button type="button" className="secondaire" style={{ borderColor: 'var(--trait)' }} onClick={onRegenerer} disabled={chargement}>
            {chargement ? 'Composition…' : 'Autre version'}
          </button>
          <button type="button" className={enregistree ? 'secondaire' : 'principal'} onClick={onEnregistrer}>{enregistree ? 'Enregistrée ✓' : 'Enregistrer'}</button>
        </footer>
        </div>
      </div>
    </div>
  );
}
