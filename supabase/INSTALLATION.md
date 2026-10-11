# Brancher yoga-app sur Supabase

Environ 15 minutes. Sans ces étapes, l'appli continue de fonctionner en mode local (JSON + navigateur).

## 1. Créer le projet

Sur le compte Supabase voulu : **New project** → nom `yoga-app`, région **West EU (Paris)** (`eu-west-3`), mot de passe de base de données à conserver dans votre gestionnaire de mots de passe.

## 2. Créer les tables et les règles d'accès

1. Ouvrez `supabase/schema.sql`, remplacez `VOTRE.EMAIL@exemple.fr` (tout en bas) par **votre email**.
2. Supabase → **SQL Editor** → **New query** → collez tout le fichier → **Run**.

Le script crée :

| Table | Contenu | Qui lit | Qui écrit |
|---|---|---|---|
| `postures` | la bibliothèque | tout le monde | admins, script de synchro |
| `fiches` | les fiches « Comment faire ? » | tout le monde | serveur (génération), admins (validation, modification) |
| `seances` | les séances enregistrées | chacun les siennes | chacun les siennes |
| `admins` | les emails administrateurs | personne depuis l'appli | SQL Editor uniquement |

Pour ajouter un admin (avec mot de passe) : `npm run creer-admin -- autre@email.fr` — le mot de passe est demandé dans le terminal. Le script crée le compte (ou change son mot de passe) et l'ajoute à `admins`. Les admins se connectent via « Je suis administrateur » (email + mot de passe) dans l'écran « Mes séances et fiches ».

## 3. Configurer la connexion par email

Supabase → **Authentication** → **URL Configuration** :
- **Site URL** : l'adresse Vercel de l'appli (ex. `https://yogapp.vercel.app`) ;
- **Redirect URLs** : ajoutez la même adresse et `http://localhost:5173`.

Le service d'email intégré de Supabase est limité à quelques emails par heure : suffisant pour vous, à remplacer par un SMTP (Brevo, Resend…) si d'autres personnes se connectent.

## 4. Récupérer les clés

Supabase → **Project Settings** → **API Keys** :
- **Project URL** ;
- **Publishable key** (`sb_publishable_…`) : peut être exposée au navigateur ;
- **Secret key** (`sb_secret_…`) : **secrète**, à ne mettre que dans `.env.local` et dans Vercel. Ne la partagez avec personne (pas même dans une conversation).

Ajoutez-les à `.env.local` (modèle : `.env.example`) :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…
```

## 5. Envoyer la bibliothèque

```bash
npm install
npm run sync-bibliotheque
```

Les 203 postures du tableau partent dans la table `postures`. Relancez cette commande après chaque modification du tableau Excel : plus besoin de redéployer.

## 6. Configurer Vercel

Vercel → projet → **Settings** → **Environment Variables**, pour *Production* (et *Preview* si besoin) :

| Nom | Valeur |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key |
| `GEMINI_API_KEY` | (déjà en place) |

Puis redéployez (`git push`, ou **Redeploy** dans Vercel) : les variables `VITE_` sont intégrées au moment du build.

## 7. Première connexion

Dans l'appli : **Mes séances et fiches** → votre email → lien reçu → vous êtes connecté, avec le badge **Admin**.
Si l'appareil contient des séances ou des fiches validées enregistrées avant, un bouton propose de **les transférer sur votre compte**.

## Ce qui change à l'usage

- **Fiches** : générées une seule fois par posture, puis partagées par tous les appareils. Seul un admin connecté valide, modifie ou régénère. Les fiches sont désormais rédigées « tous publics » ; les adaptations (prénatal, De Gasquet…) passent par les variantes et les précautions.
- **Séances** : enregistrées sur votre compte, visibles sur tous vos appareils. Sans connexion, elles restent sur l'appareil.
- **Bibliothèque** : `npm run sync-bibliotheque` met à jour la base ; l'appli lit la base au démarrage (copie locale en secours si Supabase ne répond pas).
