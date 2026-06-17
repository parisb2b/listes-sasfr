# PROMPT CLAUDE CODE — CORRECTIONS LISTES (listes.sasfr.com)

Deux bugs constatés sur le déploiement en production à corriger. Lire le code existant dans `C:\DATA-MC-2030\LISTES` avant toute modification. Suivre les règles habituelles : `git add -A && git commit -m "..." && git push` après chaque correction validée, mise à jour de `MAJ-LISTES.txt` à la fin avec le détail des corrections apportées.

---

## ⚠️ RÈGLE ABSOLUE — PÉRIMÈTRE STRICTEMENT LIMITÉ AUX DEUX BUGS CI-DESSOUS

Cette règle prime sur tout le reste de ce prompt et sur toute initiative personnelle.

- **Périmètre fermé** : seules les deux corrections décrites dans ce document sont autorisées. Aucune autre modification, même "petite", même "amélioration évidente", même "pendant que j'y suis", n'est permise. Si quelque chose d'autre semble cassé, mal nommé, ou améliorable en cours de route, NE PAS le corriger : le signaler uniquement dans `MAJ-LISTES.txt` en fin de mission, dans une section "Observations hors périmètre — non traitées", sans y toucher.
- **Ne rien casser de ce qui fonctionne** : avant toute modification, identifier précisément le ou les fichiers, fonctions, ou blocs de code concernés par CHAQUE bug, et ne modifier QUE cela. Ne pas réécrire, reformater, renommer, réorganiser, ou "nettoyer" du code adjacent qui n'est pas la cause du bug, même s'il semble imparfait.
- **Pas de refactoring déguisé** : ne pas changer la structure des données Firestore existantes (noms de collections, noms de champs déjà en place) sauf si cela s'avère être la cause racine exacte du Bug 2 — et dans ce cas, le changement doit être minimal (renommage ciblé du seul champ fautif) et documenté explicitement avec justification dans le rapport, pas une remise à plat du modèle.
- **Tester la non-régression avant de conclure** : après chaque correction, revérifier manuellement (ou par test réel) que les fonctionnalités suivantes marchent toujours comme avant : connexion/inscription, création de liste, attribution, affichage des listes en sidebar (Mes listes / Listes partagées / Toutes les listes pour l'admin), ajout de tâche, changement de statut, export Excel/PDF, archivage de liste. Si une régression est détectée sur l'une de ces fonctions suite à la correction, revenir en arrière (git revert ou correction immédiate) avant de considérer la mission terminée.
- **En cas de doute sur l'étendue d'une correction** : toujours choisir l'option la plus chirurgicale et la plus limitée, même si une solution plus large semblerait "plus propre". La priorité absolue est la stabilité de ce qui fonctionne déjà, pas l'élégance du code.
- **Commits séparés** : un commit Git distinct par bug corrigé, avec un message clair identifiant le bug (ex: `fix: tri des tâches par favori/statut`, `fix: visibilité listes partagées - normalisation email`), pour permettre un rollback ciblé si nécessaire.

---

## BUG 1 — Ordre d'affichage des tâches incorrect

**Constat actuel :** les tâches s'affichent dans leur ordre de création (ou un ordre arbitraire), sans tenir compte de leur statut ni de leur statut favori.

**Comportement attendu :** dans TOUTE vue affichant une liste de tâches (vue liste unique ET vue "Toutes les listes"), les tâches doivent toujours être triées automatiquement selon cette priorité, recalculée à chaque changement :

1. **Favoris en premier**, tout en haut, peu importe leur statut (rouge/bleu/vert) — les tâches favorites doivent toujours apparaître avant les non-favorites.
2. Parmi les tâches non favorites (et aussi à l'intérieur du groupe des favoris, entre elles) : trier par statut dans cet ordre :
   - 🔴 Non exécuté (rouge) — en premier
   - 🔵 En cours (bleu) — en deuxième
   - 🟢 Fait (vert) — en dernier, tout en bas
3. À égalité de favori et de statut, conserver l'ordre de création (les plus anciennes d'abord), sauf indication contraire.

Ce tri doit être appliqué :
- au chargement initial de la liste
- immédiatement après chaque changement de statut (clic sur En cours / Fait / Non exécuté)
- immédiatement après chaque toggle de favori (clic sur l'étoile)
- que ce soit en vue liste unique ou en vue "Toutes les listes" (admin)

Implémentation suggérée : ne pas se reposer sur l'ordre Firestore brut. Après récupération des tâches (via onSnapshot), trier le tableau en JS avant rendu avec une fonction de comparaison du type :
```js
function compareTasks(a, b) {
  if (a.fav !== b.fav) return a.fav ? -1 : 1;
  const order = { red: 0, blue: 1, green: 2 };
  if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
  return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
}
```
Appliquer ce tri à chaque rendu de liste de tâches, dans toutes les vues concernées, et renuméroter l'affichage (#01, #02, ...) après tri, pas avant.

---

## BUG 2 — Listes partagées invisibles / non instantanées pour l'assigné

**Constat précis observé par l'utilisateur :**
1. Connexion en admin (parisb2b@gmail.com)
2. Création d'une liste, ajout de tâches
3. Attribution de la liste à l'email christellechen77@gmail.com (note : vérifier l'orthographe exacte de l'email utilisé par l'utilisateur — il a écrit "Christellechen77.gmail.com" sans @ dans son message, à clarifier/corriger si c'est une coquille de saisie de sa part)
4. Connexion avec le compte de cette personne assignée
5. Rafraîchissement complet de la page (pas juste attente en temps réel)
6. **La liste partagée n'apparaît toujours pas dans "Listes partagées avec moi"**, même après un rechargement complet de la page.

**Important pour le diagnostic :** ce n'est PAS un problème de latence ou de synchronisation temps réel — puisqu'un rechargement complet de page recharge tout depuis zéro et devrait afficher la liste immédiatement si elle est correctement requêtée et autorisée. Le symptôme indique une des deux causes suivantes (à vérifier dans cet ordre) :

### A. Vérifier la requête Firestore pour "Listes partagées avec moi"
Elle doit interroger la collection `listes_lists` (ou le nom réel de la collection utilisée) avec une condition du type :
```js
where('assignees', 'array-contains', currentUserEmail)
```
Vérifier que :
- Le champ s'appelle bien `assignees` partout (cohérence entre le code d'écriture lors de l'attribution et le code de lecture pour le rendu de la sidebar)
- L'email comparé est bien normalisé de la même façon des deux côtés (attention à la casse — un email stocké en majuscules ne matchera pas une comparaison en minuscules ; lower-case systématiquement les emails à l'écriture ET à la lecture)
- Le listener onSnapshot de cette requête est bien relancé/réabonné après chaque connexion (pas seulement configuré une fois au chargement initial avant que l'utilisateur ne soit authentifié)

### B. Vérifier les Firestore Security Rules
Si la requête est correcte mais que les règles de sécurité (`firestore.rules`) sont trop restrictives, la requête échoue silencieusement (permission-denied) et aucune erreur n'est forcément affichée à l'écran. Vérifier que la règle de lecture sur `listes_lists` autorise explicitement :
```
allow read: if request.auth != null && (
  resource.data.createdBy == request.auth.token.email ||
  request.auth.token.email in resource.data.assignees ||
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.admin == true
);
```
Tester ce point en ouvrant la console développeur (F12 → Console) connecté avec le compte assigné, et vérifier s'il y a une erreur Firestore du type `permission-denied` au chargement de la page. Si Claude Code a accès à un navigateur de test, vérifier ce point directement plutôt que de deviner.

### C. Vérifier qu'il n'y a pas de double-collection ou de typo de nom de champ
Confirmer qu'il n'existe pas une incohérence entre le nom de la collection ou du champ utilisé lors de la création/attribution de liste, et celui utilisé lors de la requête de lecture (ex: `assignees` vs `assignee` vs `members` — un renommage partiel pourrait avoir eu lieu lors du développement initial).

**Une fois corrigé**, tester en conditions réelles avec les deux comptes mentionnés (admin parisb2b@gmail.com et le compte assigné) et confirmer dans MAJ-LISTES.txt que le test a été effectué avec succès — pas seulement vérifié par lecture de code.

---

## RAPPORT ATTENDU DANS MAJ-LISTES.txt

Pour chacun des deux bugs :
- Cause racine identifiée (avec citation du code fautif si pertinent)
- Fichier(s) et fonction(s) exact(s) modifiés (liste précise, rien d'autre ne doit avoir été touché)
- Correction appliquée
- Méthode de vérification utilisée (test réel multi-compte de préférence, pas seulement relecture de code)
- Résultat du test

En plus, ajouter obligatoirement deux sections :

**Section "Vérification de non-régression"** : confirmer un par un que chacun des points suivants fonctionne toujours après les corrections : connexion/inscription, création de liste, attribution, affichage sidebar (Mes listes / Listes partagées / Toutes les listes admin), ajout de tâche, changement de statut, export Excel/PDF, archivage de liste.

**Section "Observations hors périmètre — non traitées"** : si quoi que ce soit d'autre a été repéré comme potentiellement à améliorer ou corriger pendant le travail, le lister ici sans l'avoir modifié, pour décision ultérieure de l'utilisateur.
