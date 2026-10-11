# yoga-app — générateur de séances de yoga

Application React/Vite qui compose une séance (style, durée, niveau, thème) à partir de votre bibliothèque de postures, avec Gemini Flash pour l'enchaînement et les fiches « Comment faire ? ».

## Lancer en local

```bash
cd ~/Documents/Developpement/yoga-app
npm install
cp .env.example .env.local      # puis collez votre clé GEMINI_API_KEY dedans
npm run dev                     # http://localhost:5173
```

Sans clé, l'appli fonctionne en **mode hors-ligne** : un générateur simple compose la séance sans IA, et les fiches « Comment faire ? » sont indisponibles.

## Déployer sur Vercel

Le projet Vercel doit avoir la variable d'environnement `GEMINI_API_KEY` (et éventuellement `GEMINI_MODEL`).

- **Avec GitHub** : poussez ce dossier sur un dépôt relié au projet Vercel, chaque push déploie.
- **Sans GitHub** : `npx vercel link` (choisir le projet existant), puis `npx vercel --prod`.

Vercel détecte Vite automatiquement ; les fichiers de `api/` deviennent des fonctions serveur.

## Mettre à jour la bibliothèque

1. Modifiez le tableau (onglet « Postures ») et enregistrez-le en `.xlsx`.
2. Remplacez `scripts/bibliotheque-postures-yoga.xlsx` (ou passez le chemin en argument).
3. `npm run import-bibliotheque` régénère `src/data/postures.json`.

La structure des cours (part du temps par phase et par style) est dans `src/data/structures.json`.

## Organisation

| Dossier | Rôle |
|---|---|
| `src/` | Interface (formulaire, séance, fiche posture, mes séances) |
| `src/data/` | Bibliothèque de postures et structures de cours (JSON) |
| `api/` | Fonctions serveur Vercel : `generer-seance`, `fiche-posture` |
| `lib/` | Logique serveur : présélection, appel Gemini, vérification |
| `scripts/` | Import du tableau Excel |

## Fonctionnement de la génération

1. **Code** : filtre les postures du style et du niveau, calcule le temps de chaque phase.
2. **Gemini** : choisit et ordonne les postures (identifiants de la bibliothèque uniquement), sortie JSON imposée par un schéma.
3. **Code** : rejette tout identifiant inconnu, relance une fois si la réponse est mauvaise.

Les précautions affichées viennent toujours de la bibliothèque, jamais de Gemini.

## Séance autour d'une posture cible

Dans le formulaire, « Posture cible » permet de chercher une posture de la bibliothèque (nom français, sanskrit ou anglais). La séance devient alors une progression vers cette posture :

- le code ajoute une phase « Pic » si le style n'en a pas (Yin, De Gasquet…), en prenant 10 % du temps sur la phase la plus longue ;
- la cible, sa chaîne de préparation (colonne « Préparation », remontée sur plusieurs niveaux) et sa contre-posture sont toujours disponibles, même hors du style ou au-dessus du niveau choisi (un avertissement s'affiche alors) ;
- Gemini construit la montée en intensité ;
- le code garantit que la cible est la **dernière posture du pic**, présente une seule fois, et que sa contre-posture ouvre le retour au calme.

Dans la séance, la cible, ses préparations et sa contre-posture sont étiquetées.

### Ce qui guide la progression (colonnes du tableau)

- **Zones sollicitées** : ce que chaque posture ouvre ou renforce (21 zones, liste dans l'onglet « Listes »). Gemini doit préparer toutes les zones de la cible avant elle ; le code vérifie et **relance une fois** Gemini en lui indiquant les zones oubliées. L'écran Séance affiche le bilan (✓ / ✗), recalculé à chaque remplacement.
- **Préparations** (plusieurs, séparées par « ; ») : la chaîne de préparation reprend aussi les préparations des préparations quand elles travaillent les mêmes zones, puis l'ordonne du plus général au plus proche de la cible.
- **Contre-postures** (plusieurs, séparées par « ; ») : la première trouvée ouvre le retour au calme.
- Le remplacement ⇄ propose en priorité des postures qui travaillent les mêmes zones.

`npm run import-bibliotheque` signale toute préparation ou contre-posture dont le nom ne correspond à aucune posture du tableau.

## Modèles Gemini et bascule automatique

| Rôle | Modèle par défaut | Variable |
|---|---|---|
| Principal | `gemini-3.8-flash` | `GEMINI_MODEL` |
| Secours | `gemini-3.5-flash-lite` | `GEMINI_MODEL_SECOURS` |

L'appli bascule sur le modèle de secours si le principal :
- met trop de temps à répondre (20 s pour une séance, 12 s pour une fiche — réglables avec `GEMINI_DELAI_SEANCE_MS` et `GEMINI_DELAI_FICHE_MS`) ;
- est surchargé ou renvoie une erreur serveur (429, 500, 503…) ;
- renvoie un JSON illisible.

Une clé refusée (401/403) ne déclenche pas de bascule : l'erreur s'affiche directement. Le modèle qui a répondu est indiqué dans la réponse (`modele`) et dans les logs Vercel (`[gemini] … → bascule sur …`).

`vercel.json` laisse jusqu’à 90 s aux fonctions : délai du modèle principal, appel de secours éventuel et, pour une posture cible, une relance si des zones ne sont pas préparées.

## Fiches « Comment faire ? » en mode local (sans Supabase)

Ordre de priorité à l'ouverture d'une fiche :
1. **Version locale** (générée, modifiée ou validée sur cet appareil) ;
2. **Fiche de référence** livrée avec l'appli (`src/data/fiches.json`) ;
3. **Génération par Gemini** (puis mise en cache locale).

- **Non validée** : bouton « Régénérer la fiche ».
- **Validée** : verrouillée, plus de régénération. Retirer la validation (re-cliquer sur « Validée ✓ ») la déverrouille.
- **Modifier** → « Enregistrer et valider » : votre texte devient la version validée.

**Exporter / importer** (écran *Mes séances et fiches*) : « Exporter » télécharge `fiches-validees-AAAA-MM-JJ.json`. « Importer » charge ce fichier sur un autre appareil.

**Faire de vos fiches la référence partout** :

```bash
npm run import-fiches ~/Downloads/fiches-validees-AAAA-MM-JJ.json
```

Le script les intègre à `src/data/fiches.json` (une fiche existante est remplacée) ; au prochain déploiement, tout appareil les affiche comme « Fiche de référence de votre bibliothèque », sans appel à Gemini.

## Stockage : Supabase

Avec Supabase configuré, la bibliothèque, les fiches et les séances sont en base (comptes, règles d'accès RLS, cache partagé des fiches). Installation pas à pas : **`supabase/INSTALLATION.md`** ; schéma : `supabase/schema.sql`.

| Commande | Effet |
|---|---|
| `npm run sync-bibliotheque` | tableau Excel → `src/data/postures.json` + table `postures` |
| `npm run import-fiches fichier.json` | fiches exportées → table `fiches` (validées) |

Sans Supabase (variables absentes), l'appli fonctionne comme avant : bibliothèque JSON, séances et fiches dans le navigateur.
