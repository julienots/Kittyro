# Architecture technique

## Pourquoi pas Unity ?

Le cahier des charges suggérait Unity/URP. L'environnement de production de ce dépôt ne dispose ni
de l'éditeur Unity, ni de sa licence, ni de l'accès aux dépôts Google (SDK Android/Gradle). Plutôt
que de livrer des scripts C# impossibles à compiler et tester, le jeu est construit avec une pile
qui se compile, se teste et s'empaquette réellement ici :

- **TypeScript + Three.js (WebGL 2)** pour le rendu 2.5D, **Vite** pour le bundle mono-fichier ;
- une **coquille Android native** (Java, WebView matérielle plein écran) qui sert le jeu depuis les
  assets de l'APK sur une origine https privée, avec un pont natif pour les sauvegardes.

Les principes demandés pour Unity sont transposés : données découplées (équivalent ScriptableObjects
→ `src/data/*`), logique pure testable, pooling, instancing, niveaux de qualité, chargement par zone.

## Arborescence

```
game/src/
  core/      EventBus, PRNG déterministe + bruit, pool d'objets, maths
  data/      tables de contenu : cultures, animaux, poissons, insectes, créatures, ressources,
             recettes, bâtiments, décorations & meubles, PNJ, village, régions, fêtes, quêtes,
             boutiques/Cozy Pass, garde-robe, items
  state/     GameState (JSON pur) + création de partie
  systems/   logique headless : Inventory, Economy, Collections, Farming, Animals, Crafting,
             Quests, Village, Npcs, Fishing, Gathering, Creatures, Weather, Time, Festivals,
             Shop, Building, Mining, Tools — orchestrés par Ctx
  save/      SaveManager (local / fichier Android / cloud), migrations, réparation, réglages
  render/    Renderer (qualité, tilt-shift, résolution dynamique), matériaux toon, ciel jour/nuit,
             caméra, particules GPU, météo, sprites emoji
  models/    modèles procéduraux fusionnés : personnages, animaux, créatures, nature, bâtiments, props
  world/     layouts des 9 zones, terrain diorama, instancing, vue ferme, vue maison, World (A*, collisions)
  entities/  joueur, PNJ (emplois du temps), animaux (IA), faune sauvage, gestionnaire
  input/     joystick flottant, toucher-pour-aller, pinch, clavier
  audio/     musique procédurale adaptative, ambiances, SFX et cris d'animaux synthétisés
  ui/        HUD, panneaux, dialogues, écrans titre/création
  minigames/ pêche, mini-jeux de fête
  game/      Game (boucle, interactions, transitions), Placement (construction au doigt)
android/     AndroidManifest, MainActivity, icônes, build.sh
```

## Flux de données

`GameState` est l'unique source de vérité sérialisée. Les **systèmes** la modifient et émettent des
événements sur le bus (`plot:changed`, `harvested`, `village:restored`…). Les **vues** (monde 3D,
UI, audio) écoutent ces événements. La logique ne dépend d'aucune API DOM/WebGL : elle tourne en
Node dans les tests (`game/tests/logic.test.ts`).

## Rendu & performances mobiles

- Modèles composés de primitives **fusionnées en une géométrie à couleurs de sommets** : un draw call
  par bâtiment/personnage-membre.
- Arbres, rochers, cultures, décors, herbe et fleurs en **InstancedMesh** (un draw call par type).
  Une zone complète tient en ~50–110 draw calls.
- **Particules GPU** : un seul mesh instancié par mode de fusion, pool de taille fixe, zéro allocation.
- Lumières dynamiques en nombre constant (pas de recompilation de shaders), attribuées aux lampes
  les plus proches la nuit.
- **Niveaux LOW / MEDIUM / HIGH / ULTRA** (résolution, ombres 0/1024/2048/4096, tilt-shift, densité
  d'herbe, budget particules, contours) + **résolution adaptative** si les FPS descendent sous 45.
- Détection automatique de la qualité (cœurs, mémoire, mobile).
- Une seule zone chargée à la fois ; la précédente est libérée.

## Sauvegarde

- Enveloppe JSON versionnée avec **CRC32**, écriture sérialisée, **2 sauvegardes de secours** en
  rotation, repli automatique si corruption, **migrations** de version et **réparation** des champs
  manquants.
- Sur Android : fichiers dans le stockage privé de l'app, écriture **atomique** (fichier temporaire +
  `fsync` + renommage) via `MossyNative`. Ailleurs : `localStorage`.
- Sauvegarde auto toutes les 40 s, à chaque nouveau jour, à la mise en arrière-plan (`onPause`).
- Interface `CloudSyncProvider` prête pour une synchro cloud (résolution par horodatage).
- Export / import par code texte dans le menu.

## Audio

Aucun fichier audio n'existait dans le dépôt et aucun n'a été supprimé. Toute la bande-son est
générée en temps réel (Web Audio) : 12 thèmes (ferme, village, forêt, montagne, plage, nuit, pluie,
hiver, grotte, volcan, maison, fête), ambiances (vent, eau, pluie, vagues, lave, feu, oiseaux,
grillons, gouttes) et effets.
