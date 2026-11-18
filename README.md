# 🌿 Mossy Meadows — Cozy Farm Adventure 2.5D

Jeu mobile cozy original : une petite vallée flottante à faire revivre. Cultiver, élever des
animaux, restaurer le village de Willowbrook, explorer 7 régions, pêcher, miner, collectionner des
créatures, décorer sa ferme et sa maison — à son rythme, sans pression, **sans romance**.

![icône](docs/icon-512.png)

## Graphismes « Réaliste » (v1.1)

Nouvelle qualité graphique **RÉALISTE** (Menu ⚙️ → Qualité graphique), activée par défaut sur
les appareils puissants :

- matériaux PBR (MeshStandard) avec micro-relief, variations d'albédo et de rugosité procédurales,
  surfaces mouillées sous la pluie, translucidité du feuillage à contre-jour
- éclairage HDR : soleil intense, éclairage d'environnement (IBL) recapturé depuis le ciel,
  ombres 4096 px adoucies
- ciel atmosphérique : diffusion Mie, disque solaire HDR, couche de nuages volumétriques
- eau : normales de vagues, réflexion de Fresnel, reflets du soleil, diffusion sous la surface
- post-traitement cinéma : SSAO, rayons de soleil volumétriques, bloom, profondeur de champ
  bokeh, aberration chromatique, tone mapping ACES, étalonnage, vignettage, grain

Code : `game/src/render/Realism.ts` (matériaux) et `game/src/render/Cinematic.ts` (pipeline).

## Télécharger / installer

Les builds Android sont dans [`builds/`](builds/) :

| Fichier | Usage |
|---|---|
| `mossy-meadows-1.1.0-debug.apk` | APK de test (debuggable, signé clé debug) |
| `mossy-meadows-1.1.0-release.apk` | APK release signé |
| `mossy-meadows-1.1.0-release.aab` | Android App Bundle pour le Play Store |

Installation : copier l'APK sur le téléphone et l'ouvrir (autoriser les sources inconnues), ou
`adb install -r builds/mossy-meadows-1.1.0-debug.apk`. Android 7.0+ (API 24), WebGL 2 requis.

## Jouer dans le navigateur (développement)

```bash
cd game
npm install
npm run dev        # http://localhost:5173 (ouvrable depuis un téléphone sur le même réseau)
npm test           # 26 tests unitaires de la logique de jeu
npm run build      # build mono-fichier dans game/dist/index.html
```

Clavier : ZQSD/WASD/flèches pour marcher, `E`/Espace action, `F` outil, `R` changer d'outil,
`1-6` outils, `I` sac, `M` carte, `J` quêtes, `B` construire, `Échap` menu.

## Construire l'APK / l'AAB

```bash
./android/build.sh        # build web + APK debug + APK release + AAB release
```

Le script n'utilise ni Gradle ni Android Studio : `aapt2`, `javac`, `dx`, `zipalign`, `apksigner`
(paquets Debian/Ubuntu `aapt apksigner zipalign dalvik-exchange android-sdk-platform-23`).
La clé de release est créée au premier build dans `android/release.jks` + `android/release.properties`
(**non versionnées : sauvegardez-les**, elles sont nécessaires pour publier des mises à jour).

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md) — contenu et systèmes de jeu
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture technique, choix, performances, sauvegarde
- [docs/TESTING.md](docs/TESTING.md) — ce qui a été testé et comment
