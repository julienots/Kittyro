# 🌿 Mossy Meadows — Cozy Farm Adventure 2.5D

Jeu mobile cozy original : une petite vallée flottante à faire revivre. Cultiver, élever des
animaux, restaurer le village de Willowbrook, explorer 7 régions, pêcher, miner, collectionner des
créatures, décorer sa ferme et sa maison, **fonder son propre hameau avec des villageois** — à son rythme,
sans pression, **sans romance**.

![icône](docs/icon-512.png)

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
npm test           # 31 tests unitaires de la logique de jeu
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
