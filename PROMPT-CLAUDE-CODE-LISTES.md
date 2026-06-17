# PROMPT CLAUDE CODE — LISTES (listes.sasfr.com)
## Déploiement complet — projet indépendant, même principe que Comptes Client

---

## RÈGLES D'EXÉCUTION (identiques au projet Comptes Client)

1. `git add -A && git commit -m "..." && git push` après chaque étape validée — jamais attendre la fin.
2. Résoudre les erreurs de manière autonome, sans demander confirmation à chaque micro-étape.
3. Générer `MAJ-LISTES.txt` à la racine du projet à la fin, avec le détail de tout ce qui a été fait, les commandes exécutées, les éventuels écarts par rapport à ce prompt, et l'état final (build, déploiement, tests).
4. Avant toute modification significative : vérifier qu'aucun fichier/composant similaire n'existe déjà (zéro-duplication).
5. UTF-8 partout. Le projet doit supporter le FR et le 中文 sans problème d'encodage.

---

## CONTEXTE GÉNÉRAL

Ceci est le **deuxième** des trois sites prévus dans l'écosystème SASFR (avec Comptes Client = `total.sasfr.com` et Chantier Tracker = `dm.sasfr.com`). Une page d'accueil fédératrice avec ces 3 sous-domaines sera construite **plus tard**, dans un prompt séparé — ne pas s'en occuper ici.

**Dossier de travail local (déjà créé par l'utilisateur) :**
```
C:\DATA-MC-2030\LISTES
```

**Maquette HTML de référence déjà présente dans ce dossier** (fichier statique, sans backend, à utiliser comme socle visuel ET comportemental — ne pas réinventer l'UI, l'adapter à une vraie architecture React/Firebase) :
```
C:\DATA-MC-2030\LISTES\listes-sasfr-mockup-v2.html
```

Cette maquette contient déjà : l'écran de connexion, la sidebar façon explorateur de listes, le bloc "Attribuer" en bas de sidebar, la vue liste unique, la vue globale admin, les modals de création/gestion de liste, et toute la logique de filtres. **Lire ce fichier en premier** avant d'écrire le moindre code, pour comprendre exactement l'UX attendue. Le HTML/CSS/JS qu'il contient peut être directement repris et adapté en composants React — ce n'est pas un brouillon jetable, c'est la référence de design validée par l'utilisateur.

**Logiciel de référence fonctionnelle : Comptes Client** (`total.sasfr.com`, repo `parisb2b/comptes-client`). LISTES doit reprendre :
- la même stack d'authentification Firebase (email/mot de passe + Google + inscription libre + mot de passe oublié)
- le même principe de sidebar "explorateur" avec sections "Mes X" / "X partagés avec moi"
- le même bloc "Attribuer" fixe en bas de sidebar (champ email + bouton, multi-attribution)
- le même usage de Firestore en temps réel (onSnapshot) pour que tous les membres voient les mêmes données en direct

---

## INFRASTRUCTURE

### Firebase (projet existant, déjà actif — RÉUTILISER, ne pas en créer un nouveau)
```
Project ID  : sasfr-chantiers
API Key     : AIzaSyDuMelJjjPWDnJOj8_rnehddcQxRMWr058
Auth Domain : sasfr-chantiers.firebaseapp.com
App ID      : 1:478612754173:web:298cc8ff967589ce80f894
```
Utiliser Firestore (nouvelles collections dédiées à LISTES, ne touche jamais aux collections existantes de Comptes Client ou Chantier Tracker) et Firebase Authentication (Email/Password + Google provider).

### GitHub
```
User        : parisb2b
Nouveau repo: listes-sasfr (PUBLIC, séparé de comptes-client et de 97import-firebase)
Branche     : main (toujours, comme tous les autres projets SASFR)
```

### Vercel
Déployer comme projet Vercel indépendant, connecté au repo `parisb2b/listes-sasfr`, domaine personnalisé `listes.sasfr.com` (DNS à configurer par l'utilisateur ensuite sur OVH — CNAME vers la cible Vercel, ne pas bloquer le déploiement là-dessus).

---

## ÉTAPE 0 — Lecture de la maquette et choix de stack

1. Ouvrir et lire entièrement `C:\DATA-MC-2030\LISTES\listes-sasfr-mockup-v2.html`.
2. Choisir une stack proche de Comptes Client pour rester cohérent et simple : HTML/CSS/JS vanilla avec modules ES + SDK Firebase via CDN (comme Comptes Client), **sauf si** un existant `package.json`/framework est déjà présent dans `C:\DATA-MC-2030\LISTES` — dans ce cas garder la cohérence avec ce qui existe. Par défaut : vanilla JS, un seul `index.html` principal, pas de build step lourd (pas de React/Vite ici, pour rester aligné avec la simplicité de Comptes Client).
3. Créer la structure du repo :
```
C:\DATA-MC-2030\LISTES\
  index.html          (app complète : auth + shell + toutes les vues)
  firebase-config.js  (init Firebase, exporté en module)
  vercel.json
  .gitignore
  README.md
  MAJ-LISTES.txt       (généré à la fin)
```

---

## ÉTAPE 1 — Initialiser le repo GitHub

```bash
cd "C:\DATA-MC-2030\LISTES"
git init
git branch -M main
echo "node_modules/" > .gitignore
echo ".vercel/" >> .gitignore
echo "*.DS_Store" >> .gitignore
echo "# LISTES" > README.md
echo "Gestionnaire de listes de tâches collaboratif — écosystème SASFR (listes.sasfr.com)" >> README.md
```

Créer `vercel.json` :
```json
{
  "version": 2,
  "builds": [{ "src": "index.html", "use": "@vercel/static" }],
  "routes": [{ "src": "/(.*)", "dest": "/index.html" }]
}
```

```bash
gh repo create parisb2b/listes-sasfr --public --source=. --push
```

---

## ÉTAPE 2 — Authentification Firebase

Reprendre exactement le système de `total.sasfr.com` :
- Connexion par email/mot de passe
- Connexion avec Google (popup)
- Lien "Mot de passe oublié ?" → `sendPasswordResetEmail`
- Lien "S'inscrire" → création de compte libre par email/mot de passe (`createUserWithEmailAndPassword`), pas de validation admin requise
- Case "Se souvenir de moi" → persistance Firebase (`browserLocalPersistence` vs `browserSessionPersistence`)
- FR / 中文 toggle visuel (au minimum sur l'écran de login ; la traduction complète de l'app n'est pas obligatoire dans cette V1, mais structurer les textes dans un objet de traduction facilement extensible plutôt que les coder en dur partout)

À la création d'un compte, créer automatiquement un document dans une collection `users` :
```js
{
  email: "...",
  displayName: "...",        // déduit de l'email ou du profil Google
  admin: false,               // false par défaut, true seulement pour le tout premier compte créé (bootstrap) ou attribué ensuite manuellement
  createdAt: serverTimestamp()
}
```

**Bootstrap admin** : prévoir que le tout premier utilisateur qui s'inscrit (ou un email spécifique fourni en dur temporairement, ex: `michel@sasfr.com` / l'email réel que l'utilisateur précisera) soit automatiquement admin=true, pour ne pas se retrouver bloqué sans aucun admin au lancement. Documenter clairement ce mécanisme dans MAJ-LISTES.txt.

---

## ÉTAPE 3 — Modèle de données Firestore

### Collection `lists`
```js
{
  id: auto,
  name: "Bridge WhatsApp — Maintenance",
  emoji: "📦",
  createdBy: "michel@sasfr.com",       // email de l'utilisateur créateur
  assignees: ["dimitri@sasfr.com"],     // tableau d'emails, 0 à N personnes
  archived: false,                      // corbeille de LISTES (pas de tâches)
  archivedAt: null,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

### Sous-collection `lists/{listId}/tasks`
```js
{
  id: auto,
  text: "23 TOUL - 2 vasques à commander",
  status: "red" | "blue" | "green",     // non exécuté / en cours / fait
  fav: false,
  archived: false,                       // archive de TÂCHE (différent de la corbeille de liste)
  createdBy: "michel@sasfr.com",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
}
```

### Collection `users`
Comme décrit à l'étape 2 (email, displayName, admin, createdAt).

### Règles de visibilité (à appliquer côté requêtes Firestore ET côté Firestore Security Rules — les deux, jamais la sécurité seulement côté client) :
- Un utilisateur non-admin ne peut lire/écrire que les listes où `createdBy == son email` OU `son email` est dans `assignees`.
- Un utilisateur admin (`users/{uid}.admin == true`) peut lire/écrire TOUTES les listes, sans exception — c'est la vue "Toutes les listes".
- Les tâches d'une liste héritent de la même visibilité que leur liste parente.
- Tout le monde (tout compte authentifié) peut CRÉER une nouvelle liste, peu importe son rôle.

Écrire les Firestore Security Rules correspondantes (`firestore.rules`) et les déployer avec `firebase deploy --only firestore:rules`.

---

## ÉTAPE 4 — Interface : reprendre fidèlement la maquette

### 4.1 Écran de connexion
Identique à `total.sasfr.com` (cf. maquette `listes-sasfr-mockup-v2.html`, écran `#auth-screen`).

### 4.2 Shell applicatif (sidebar + zone principale)

**Sidebar :**
- Logo "LISTES" + bouton "⚙️ Gestion listes" en haut (pour cette V1, ce bouton peut ouvrir une vue simple de gestion globale — corbeille des listes archivées, et liste de tous les membres avec leur statut admin — voir étape 4.5)
- Pour un admin uniquement : ligne épinglée tout en haut "🌐 Toutes les listes" avec badge de comptage des tâches non-exécutées sur l'ensemble des listes
- Section "Mes listes" : listes où `createdBy == email courant`
- Section "Listes partagées avec moi" : listes où le créateur est différent mais l'email courant est dans `assignees`
- Chaque ligne de liste affiche : emoji, nom, badge rouge si elle contient des tâches non exécutées
- Cliquer sur une liste l'ouvre seule dans la zone principale (pas de cumul/empilement de plusieurs listes à l'écran)
- Bloc "Attribuer" fixe en bas de sidebar : montre la liste actuellement sélectionnée, ses chips d'assignés retirables en un clic, un champ email avec autocomplétion sur la collection `users`, bouton "Attribuer" qui ajoute l'email aux `assignees` de la liste sélectionnée (si la liste n'est pas sélectionnée, désactiver le bloc ou afficher "Sélectionnez une liste")
- Pied de sidebar : avatar + email + rôle (Admin/Membre) + toggle FR/中文 + bouton Quitter (déconnexion)

**Zone principale — vue liste unique ouverte :**
- Bandeau titre avec emoji + nom de la liste + "Créée par X" + nombre d'assignés
- Bouton "👥 Gérer" (visible si créateur de la liste OU admin) → modal d'assignation (ajout/retrait d'emails, identique au bloc Attribuer mais en plus confortable)
- Boutons Export Excel / Export PDF
- 3 cartes : Total tâches / 🔴 Non exécuté / 🔵 En cours
- Bouton "+ Ajouter une tâche" et bouton "🗑️ Supprimer" (mode sélection multiple de tâches à supprimer)
- 6 onglets de filtre : Toutes / 📱 À traiter / ⚡ En cours / ✅ Fait / ⭐ Favoris / 🗑️ Archives (archives = tâches archivées individuellement, champ `archived` sur la tâche)
- Liste des tâches : étoile favori cliquable, numéro, texte, métadonnées (auteur + date), 3 boutons de statut (En cours / Fait / Non exécuté)

**Zone principale — vue "Toutes les listes" (admin uniquement) :**
- Bandeau titre "Toutes les listes" + bouton "+ Nouvelle liste" + Export Excel/PDF globaux
- 3 cartes : Listes au total / 🔴 Non exécuté / 🔵 En cours (agrégées sur toutes les listes)
- Les mêmes 6 onglets de filtre, mais appliqués globalement : le filtre choisi s'applique aux tâches affichées dans CHAQUE groupe-liste listé en dessous
- Pour chaque liste, un groupe affichant : emoji + nom + "créée par X" + nombre de tâches filtrées, un bouton "+ Tâche" (ajoute directement une tâche dans CETTE liste sans avoir à l'ouvrir), un bouton "Ouvrir →" (bascule vers la vue liste unique), puis la liste des tâches filtrées avec les mêmes contrôles de statut/favori qu'en vue unique

### 4.3 Modal "Nouvelle liste"
Nom (obligatoire), emoji (optionnel, défaut 📋), champ d'assignation par email avec autocomplétion sur `users` + chips retirables. Note explicative : la liste apparaît dans "Mes listes" pour le créateur et "Listes partagées avec moi" pour les assignés.

### 4.4 Modal "Gérer une liste"
Ajout/retrait d'assignés par email avec autocomplétion. Le créateur reste toujours sur la liste (non retirable depuis cette interface).

### 4.5 Gestion des listes / Corbeille
Le bouton "⚙️ Gestion listes" ouvre une vue listant :
- Toutes les listes archivées (corbeille), avec un bouton "Restaurer" par liste et éventuellement "Supprimer définitivement" (à confirmer)
- Pour les admins seulement : la table des membres avec toggle Admin par utilisateur (réutiliser le composant déjà présent dans la maquette `renderMembersView` / vue `#view-members`)

**Suppression d'une liste entière** (à ajouter dans l'UI — bouton à prévoir dans le modal "Gérer une liste" ou dans la vue liste ouverte, ex: "🗑️ Archiver cette liste") : ne supprime jamais directement le document Firestore, passe `archived: true` + `archivedAt: serverTimestamp()`. La liste disparaît alors de la sidebar normale mais reste visible/restaurable dans "Gestion listes" → Corbeille.

### 4.6 Export Excel / PDF
- Export Excel : génère un .xlsx avec une feuille par liste exportée (colonnes : statut, texte, favori, auteur, date), via une librairie légère côté client (ex: SheetJS/xlsx déjà utilisée ailleurs dans l'écosystème SASFR) — pas besoin de backend serveur.
- Export PDF : génère un PDF simple listant les tâches groupées par liste, avec le même typage de statut en couleur. Réutiliser si possible une approche déjà utilisée sur Comptes Client/DM pour rester cohérent visuellement (logo, charte).
- Sur la vue liste unique : exporte uniquement cette liste. Sur "Toutes les listes" : exporte l'ensemble (ou les listes visibles selon le filtre actif — au choix le plus simple à implémenter, documenter le choix fait dans MAJ-LISTES.txt).

---

## ÉTAPE 5 — Temps réel

Toute donnée affichée (listes, tâches, membres) doit être branchée sur `onSnapshot` Firestore, pas sur des lectures ponctuelles `getDocs`, pour que deux personnes connectées en même temps voient les changements de l'autre sans recharger la page — exactement comme Comptes Client.

---

## ÉTAPE 6 — Build, déploiement, vérification

```bash
# Déploiement Firestore rules
firebase deploy --only firestore:rules --project sasfr-chantiers

# Vercel
vercel --prod
```

Vérifier après déploiement :
1. Inscription d'un nouveau compte fonctionne (email/mdp et Google)
2. Connexion + déconnexion
3. Création d'une liste, assignation à un autre email existant
4. Visibilité correcte : se connecter avec le compte assigné → la liste apparaît dans "Listes partagées avec moi"
5. Ajout/changement de statut/favori d'une tâche, vérifié en temps réel sur un 2e onglet/navigateur connecté avec un autre compte ayant accès à la même liste
6. Vue "Toutes les listes" visible uniquement par un compte admin=true, invisible pour un compte normal
7. Archivage d'une liste → disparaît de la sidebar, réapparaît dans Gestion listes → Corbeille → Restaurer fonctionne
8. Export Excel et PDF génèrent des fichiers valides et ouvrables

---

## RAPPORT FINAL — MAJ-LISTES.txt

Doit contenir :
1. Stack technique choisie et pourquoi (si écart par rapport au vanilla JS par défaut proposé ici)
2. État ✅/❌ de chaque étape (0 à 6)
3. Résultat des tests de l'étape 6, un par un
4. URL Vercel de déploiement (avant configuration DNS finale sur listes.sasfr.com)
5. Mécanisme de bootstrap admin retenu et comment attribuer le rôle admin à un autre compte par la suite
6. Toute limitation connue ou TODO pour une itération suivante (ex: traduction complète FR/中文, notifications email, etc. — hors scope de cette V1)
