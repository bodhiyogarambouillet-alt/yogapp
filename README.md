# Mes séances Yoga

Application pour préparer et animer des cours de yoga : elle compose une séance sur mesure à partir de votre bibliothèque de postures, l'accompagne d'une musique Spotify et la déroule en direct avec un minuteur.

- **Site** : [yogapp-alpha.vercel.app](https://yogapp-alpha.vercel.app) (téléphone et ordinateur, installable sur l'écran d'accueil)
- **Appli Android** : APK construit avec Capacitor, téléchargeable depuis le site sur ordinateur (bouton Android de la barre du haut, avec QR code)

## Fonctionnalités

**Composer une séance** — parcours en étapes : style (un ou plusieurs, ou aucun pour puiser dans toutes les postures), durée (30 à 90 min ou durée libre), niveau, puis options facultatives :
- **posture cible** : la séance devient une progression vers cette posture (préparations, montée en intensité, contre-posture) ;
- **thème ou contraintes** du groupe (ex. « lombaires fragiles », « commencer et finir par Tadasana ») — une posture peut être répétée si le thème le demande ;
- **accessoires disponibles** (aucun par défaut) ;
- **séances à éviter** : les postures des séances choisies sont évitées autant que possible.

**La séance** — phases minutées, postures avec pictogrammes, rôle (préparation, cible, contre-posture), bilan des zones préparées. On peut la modifier (ordre, durées, consignes, ajout, suppression), **remplacer une posture ou lui ajouter des variantes** (cours multi-niveaux), changer la date, l'enregistrer, l'exporter (texte, PDF, image) ou demander une autre version.

**Les fiches « Comment faire ? »** — pour chaque posture : présentation, entrée, repères, erreurs fréquentes, respiration, sortie, variantes, résumé pour le direct. Rédigées par Gemini, enregistrées en base et partagées ; les administrateurs peuvent les modifier ou les régénérer. Les précautions viennent toujours de la bibliothèque, jamais de Gemini.

**La bibliothèque** (onglet « Postures ») — les 200+ postures, recherche (nom français, sanskrit, anglais, zone du corps), filtres par famille et niveau ; chaque posture ouvre sa fiche (volet de droite sur ordinateur).

**La séance en direct** — minuteur par posture, côté droit puis gauche annoncé (bip et vibration à mi-parcours), résumé de la posture, variantes, posture suivante, écran maintenu allumé, signal à chaque changement.

**La musique (Spotify)** — pour chaque séance, une sélection de morceaux par phase dans le style choisi (Relaxation par défaut, Folk, Piano, Ambient, Bols chantants, Mantras, Nature, Lo-fi ou style libre, avec ou sans paroles). Elle démarre, se met en pause et reprend avec le minuteur, et le morceau en cours s'affiche dans le lecteur. Rien n'est créé dans Spotify, sauf si l'on choisit d'enregistrer la sélection en playlist.

**Comptes** — sans connexion, les séances restent sur l'appareil ; connecté, elles sont synchronisées. Seuls les administrateurs modifient les fiches (email + mot de passe, ou Google).

## Architecture

| Partie | Technologie | Rôle |
|---|---|---|
| Interface | React 18 + Vite | `src/` — tout le parcours, en français |
| Fonctions serveur | Vercel (`api/`, logique dans `lib/`) | génération de séance, fiches, propositions musicales, keepalive |
| IA | Gemini (REST) | choix et ordre des postures, fiches, morceaux |
| Base et comptes | Supabase (Postgres + RLS, Auth, Storage) | postures, fiches, séances, administrateurs, APK hébergé |
| Musique | API Web Spotify (OAuth PKCE côté appli) | recherche des morceaux, lecture, playlist facultative |
| Appli Android | Capacitor 8 | l'interface est embarquée dans l'APK ; les fonctions restent sur Vercel |

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis renseignez les clés
npm run dev                  # http://127.0.0.1:5173 (sert aussi les fonctions de api/)
```

Variables de `.env.local` (jamais commitées) :

| Variable | Rôle |
|---|---|
| `GEMINI_API_KEY` | clé Google AI Studio (sans elle : générateur de secours, pas de fiches ni de musique) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase côté appli (clé publiable, protégée par la RLS) |
| `SUPABASE_SECRET_KEY` | clé secrète, uniquement pour les scripts lancés sur votre ordinateur |
| `GEMINI_MODEL`, `GEMINI_MODEL_SECOURS` | modèles (par défaut `gemini-3.8-flash`, secours `gemini-3.5-flash-lite`) |
| `GEMINI_DELAI_SEANCE_MS`, `GEMINI_DELAI_FICHE_MS` | délai avant bascule sur le modèle de secours (20 s par défaut) |

Sans Supabase, l'appli fonctionne en mode local : bibliothèque JSON, séances et fiches dans le navigateur.

## Déployer

Chaque push sur `main` déploie le site sur Vercel. Variables à définir dans le projet Vercel : `GEMINI_API_KEY`, les variables Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, et `SUPABASE_SECRET_KEY` pour les fonctions), éventuellement `CRON_SECRET`.

`vercel.json` laisse jusqu'à 90 s aux fonctions, redirige `/spotify-callback` vers l'appli et appelle chaque jour `/api/keepalive` pour éviter la mise en pause du projet Supabase gratuit.

## Appli Android

```bash
npm run android:apk    # build Vite (mode capacitor) + synchronisation + APK debug (JDK 21)
npm run apk:publier    # envoie l'APK dans le stockage Supabase (bucket public « applis »)
```

- L'APK se trouve dans `android/app/build/outputs/apk/debug/app-debug.apk` (les APK ne sont pas versionnés).
- `.env.capacitor` indique l'adresse des fonctions (`VITE_API_BASE`) : l'interface est embarquée, les appels partent vers Vercel. Un changement d'interface demande donc un nouvel APK ; un changement de `api/` ou `lib/` non.
- `apk:publier` met à jour le fichier proposé sur le site (QR code et lien de la barre du haut, sur ordinateur) avec sa date et sa taille.
- Retours de connexion dans l'appli : `fr.bodhiyoga.seances://login-callback` (Google) et `fr.bodhiyoga.seances://spotify-callback` (Spotify), déclarés dans `AndroidManifest.xml`.

## Spotify

Application Spotify en mode développement (Client ID public dans `src/spotify.js`, aucun secret) :
- le propriétaire de l'appli Spotify doit avoir un abonnement **Premium** ;
- **5 comptes au plus**, à ajouter dans *User Management* du tableau de bord Spotify ;
- adresses de retour déclarées : `fr.bodhiyoga.seances://spotify-callback`, `https://yogapp-alpha.vercel.app/spotify-callback`, `http://127.0.0.1:5173/spotify-callback` ;
- la lecture pilotée par l'appli (démarrage, pause, morceau suivant) demande Premium et l'appli Spotify ouverte récemment sur un appareil.

Fonctionnement : Gemini propose des morceaux réels par phase (`/api/proposer-musique`), l'appli vérifie chacun dans le catalogue Spotify, ajuste la durée de chaque phase et complète par mots-clés si besoin. La sélection est gardée avec la séance.

## Génération d'une séance

1. **Code** : filtre les postures du style, du niveau et des accessoires, calcule le temps de chaque phase (`src/data/structures.json`).
2. **Gemini** : choisit et ordonne les postures (identifiants de la bibliothèque uniquement, sortie JSON imposée par un schéma), en tenant compte du thème et des séances à éviter.
3. **Code** : rejette tout identifiant inconnu et relance une fois si la réponse est mauvaise ou si des zones de la posture cible ne sont pas préparées.

Avec une **posture cible** : la cible, sa chaîne de préparation et sa contre-posture sont toujours disponibles (même hors style ou au-dessus du niveau, avec un avertissement) ; le code garantit que la cible est la dernière posture du pic, une seule fois, suivie de sa contre-posture.

Si le modèle principal est lent, surchargé ou renvoie un JSON illisible, l'appel bascule automatiquement sur le modèle de secours (une clé refusée ne bascule pas).

## Supabase

Installation pas à pas : `supabase/INSTALLATION.md` ; schéma et règles d'accès : `supabase/schema.sql`.

| Commande | Effet |
|---|---|
| `npm run sync-bibliotheque` | tableau Excel → `src/data/postures.json` + table `postures` |
| `npm run pregenerer-fiches` | rédige les fiches manquantes dans `scripts/fiches-pregenerees.json` (`-- --import` pour les envoyer en base) |
| `npm run import-fiches fichier.json` | importe des fiches en base |
| `npm run creer-admin -- email@exemple.fr` | crée ou met à jour un compte administrateur (mot de passe saisi dans le terminal) |
| `npm run apk:publier` | publie l'APK dans le stockage |

## Mettre à jour la bibliothèque

1. Modifiez le tableau (onglet « Postures ») : familles, niveaux, styles, zones sollicitées, préparations et contre-postures (plusieurs, séparées par « ; »), précautions.
2. Remplacez `scripts/bibliotheque-postures-yoga.xlsx`.
3. `npm run sync-bibliotheque` — le script signale toute préparation ou contre-posture qui ne correspond à aucune posture.

## Organisation du code

| Dossier | Contenu |
|---|---|
| `src/components/` | écrans et composants : `Formulaire` (parcours en étapes et décor), `Seance`, `Live`, `Fiche`, `Bibliotheque`, `MesSeances`, `Compte`, `Musique`, `MusiqueLive`, `ChargementSeance`, `Dialogue`, `TelechargerApk`… |
| `src/` | logique côté appli : bibliothèque, stockage, Spotify, musique, export, dates, fonctions natives |
| `src/data/` | postures, structures de cours, fiches de référence |
| `src/assets/pictos/` | pictogrammes des 16 familles de postures (WebP) |
| `api/`, `lib/` | fonctions Vercel et leur logique (séance, fiche, musique, Gemini, Supabase) |
| `scripts/` | import de la bibliothèque, fiches, comptes admin, publication de l'APK |
| `supabase/` | schéma et guide d'installation |
| `android/` | projet Capacitor Android (icônes et écran de démarrage dans `app/src/main/res`) |
| `public/` | favicon, icônes du site installable, manifeste |

## Identité visuelle

Fond crème (`#F3ECE1`), terracotta (`#A9472A`), sable ; titres en Marcellus, texte en Karla. Le logo et le décor reprennent des **ronds concentriques**, comme une goutte dans l'eau : demi-cercles depuis le bord gauche sur l'accueil et le parcours (avec des ondes légères), ronds qui ondulent sur l'écran de chargement et derrière le pictogramme du lecteur. Les animations respectent le réglage « réduire les animations » du système.
