# Tests

## Automatisés

| Commande | Contenu |
|---|---|
| `cd game && npm test` | 31 tests unitaires (dont 5 pour le hameau : données, arrivée/production/collecte, niveaux, souhaits/cadeaux, migration des anciennes sauvegardes) (Vitest) sur la logique pure : intégrité des données, agriculture (labour, semis, arrosage, croissance, récolte, repousse, saisons), inventaire (piles, débordement → remise, décorations), temps (endormissement à 2 h, pluie qui arrose), quêtes (histoire, quotidiennes, livraisons, déblocage de région), village, artisanat, animaux & production, placement, boutique, récolte d'arbres et repousse, pêche, mines (échelle sur chaque étage), sauvegarde (aller-retour, CRC + secours, migration/réparation, export/import). |
| `node e2e/play.mjs` | Parcours joueur dans Chromium (WebGL) : écran titre → création → déplacement clavier → dialogue avec Moss → outils → tous les panneaux → voyage au village → nuit → sauvegarde. |
| `node e2e/systems.mjs` | 20 vérifications de systèmes en conditions réelles : labour/semis/arrosage/récolte via les vrais boutons, coupe d'arbre et minage (outil auto), vente, restauration de la boutique, dialogue PNJ, construction d'un poulailler au doigt, adoption, sommeil → jour 2 → œuf, pêche, mine + échelle cachée + étage 2, mini-jeu de fête, pluie/automne/arc-en-ciel/hiver, **sauvegarde → rechargement de la page → Continuer**. |
| `node e2e/explore.mjs` | Visite des 7 régions extérieures, apparition forcée de créatures/insectes/animaux sauvages, observation, artisanat, placement d'un canapé dans la maison. |
| `node e2e/hamlet.mjs [url] [WxH]` | Parcours du hameau : sentier ferme → Clairefontaine, construction via la vraie UI de placement, arrivée du 1er villageois, nuit → production, registre (bouton d'action) → « Tout récupérer », dialogue villageois + souhait exaucé, menus, passants à Willowbrook (8 vérifications). |
| `node e2e/camera.mjs [url]` | Vrais gestes de souris : glisser le bâtiment fantôme, flèche de précision, rotation, construction d'un poulailler tourné, débris non bloquants, rotation caméra au glisser, vue 1ʳᵉ personne (marche, hache), **deux doigts simultanés (joystick + regard)** et retour (9 vérifications). |
| `node e2e/look.mjs <url> <prefix> "<js>;;shot;;…"` | Captures d'écran scriptées pour vérifier un rendu. |
| `node e2e/store.mjs [url] [dossier]` | Captures 1920×1080 pour la fiche Play Store (ferme, hameau, registre, village au crépuscule, 1ʳᵉ personne, carte) dans `store/screenshots`. |
| `node e2e/mobile.mjs <url>` | Build de production sur viewport téléphone paysage & portrait avec événements tactiles (joystick). |

Les scripts e2e attendent le serveur de dev (`npm run dev -- --port 5173`) ou le build servi
(`npx http-server game/dist -p 5180`), et Chromium (`/opt/pw-browsers`).

Résultat de la dernière exécution (v1.5.0) : 34/34 tests unitaires, 20/20 vérifications systèmes, 8/8 hameau, 9/9 caméra & placement, 0 erreur
JavaScript sur l'ensemble des parcours.

## Android

`android/build.sh` vérifie chaque APK avec `apksigner verify` (schémas v2 + v3). Contrôlé avec
`aapt dump badging` : package `com.mossymeadows.game`, minSdk 24, targetSdk 36, icônes toutes
densités, `resources.arsc` non compressé, `classes.dex` présent, `debuggable` uniquement sur l'APK debug.

**Limite honnête :** aucun émulateur ni appareil Android n'est disponible dans l'environnement de
build ; l'APK n'a donc pas été lancé sur un téléphone. Le jeu lui-même a été testé dans Chromium
(même moteur que la WebView Android) en émulation mobile. À vérifier sur appareil : installation,
démarrage, fluidité (le rendu logiciel SwiftShader utilisé pour les tests n'est pas représentatif
des FPS réels ; la qualité s'adapte automatiquement), persistance des sauvegardes via `MossyNative`.
