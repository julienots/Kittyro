# 📦 Dépôt de modèles 3D

Déposez ici vos propres modèles 3D : ils sont **intégrés automatiquement au jeu** au prochain
build (web, APK et AAB). Aucun code à écrire.

```
game/models/
├── override/        ← remplace un modèle du jeu (arbre, rocher, meuble, bâtiment…)
├── world/           ← modèles libres, placés où vous voulez avec placements.json
├── models.json      ← réglages facultatifs par modèle (échelle, rotation…)
└── placements.json  ← où poser les modèles de world/
```

## Envoyer un modèle depuis GitHub (sans rien installer)

1. Sur GitHub, ouvrez le dossier `game/models/override` (ou `game/models/world`).
2. **Add file → Upload files**, glissez votre fichier `.glb`, puis **Commit changes**.
3. L'action GitHub **« Modèles 3D »** vérifie le fichier (format, nom, poids) et construit le
   jeu. Le résultat (`index.html` jouable) est téléchargeable dans l'onglet **Actions** du dépôt.

En local : copiez le fichier dans le dossier, puis `npm run dev` (rechargement immédiat) ou
`npm run build`. `npm run models:check` vérifie tous les modèles.

## Règles

| | |
|---|---|
| Format | **`.glb`** (glTF binaire, textures incluses). Blender : *Fichier → Exporter → glTF 2.0*, format « glTF Binary ». FBX/OBJ/.gltf séparés : non. |
| Nom | minuscules, chiffres et `_` : `tree_oak.glb`, `statue_chat.glb` |
| Unités | **1 unité = 1 mètre**, **Y vers le haut**, l'avant du modèle vers **+Z**. Le personnage mesure ~1,3 m, une case de terrain = 1 m. |
| Origine | libre : le modèle est automatiquement centré et posé au sol (désactivable avec `"ground": false`). |
| Poids | ≤ 15 Mo par fichier (visez < 1 Mo pour le mobile : low-poly, textures 512–1024 px). |
| Compression | pas de Draco / Meshopt (non décodés). |

## `override/` — remplacer un modèle du jeu

Le nom du fichier choisit le modèle remplacé. Les couleurs et textures sont « cuites » dans le
style toon du jeu, donc le modèle garde le vent, la neige, la transparence près du joueur, les
ombres et l'instanciation (milliers d'arbres sans perte de performance).

| Catégorie | Noms de fichier |
|---|---|
| Arbres & nature | `tree_oak` `tree_pine` `tree_birch` `tree_palm` `tree_snow` `tree_ash` `tree_giant` `stump` `stump_small` `bush_berry_full` `bush_berry_empty` (ou `bush_berry` pour les deux) `bush_snow` `weeds` `driftwood` `clay_spot` |
| Rochers & minerais | `rock` `rock_big` `boulder` `ore_copper` `ore_coal` `ore_iron` `ore_gold` `ore_crystal` `ore_frost` `ore_ember` `geode_node` |
| Cueillette | `forage_<objet>` (ex. `forage_mushroom`) |
| Coffres | `chest_closed` `chest_open` (ou `chest`) |
| Décor du paysage | `rocks_small` `log_small` `mushrooms` `fern` `shells` `ice_shards` `crystals_small` `cliff_rock` `ember_rocks` `standing_stone` `ruin_wall` `wildflowers` `tall_grass` |
| Décorations & meubles | l'`id` de la décoration, voir `src/data/decor.ts` : `bench` `lamp_post` `fountain` `fox_statue` `barrel` `crates` `scarecrow` `well` `gazebo` `bed_simple` `sofa` `piano` `aquarium` … (≈ 120 au total) |
| Bâtiments de la ferme | `building_house` `building_coop` `building_barn` `building_stable` `building_sanctuary` `building_silo` `building_greenhouse` `building_mill` `building_workshop` `building_kitchen` `building_forge` `building_dairy` `building_beehive` `building_pond` `building_shed` |
| Village (restauré) | `building_shop` `building_bakery` `building_florist` `building_market` `building_fishing` `building_fountain` `building_park` `building_house` `building_stable` `building_workshop` |
| Hameau | `building_h_hut` `building_h_cottage` `building_h_stonehouse` `building_h_manor` `building_h_lumber` `building_h_quarry` `building_h_fields` `building_h_fishery` `building_h_bakery` `building_h_weaver` `building_h_smithy` `building_h_apiary` `building_h_tavern` `building_h_market` `building_h_well` `building_h_bandstand` `building_h_statue` |
| Structures | `lighthouse` `windmill` `ruin_tower` `lookout` `stone_circle` `tent` `campfire` `signpost` `igloo` `boat` `mine_entrance` `shrine` … |

Les bâtiments sont mis à l'échelle pour remplir leur emprise au sol (sauf si `scale` est donné
dans `models.json`) ; portes, fumée de cheminée et lumières restent celles du jeu.

> Personnages et animaux ne sont pas encore remplaçables (ils sont articulés et animés par le jeu).

## `world/` — poser des modèles n'importe où

1. Mettez `mon_modele.glb` dans `world/`.
2. Ajoutez une ligne dans `placements.json` :

```json
[
  { "model": "mon_modele", "region": "highlands", "x": 60, "z": 50, "rot": 90, "scale": 1.5 }
]
```

| Champ | |
|---|---|
| `model` | nom du fichier sans `.glb` |
| `region` | `farm` `village` `woods` `mountains` `coast` `frosty` `ember` `hamlet` `highlands` `house` `mine` |
| `x`, `z` | position en cases (mètres). Astuce : menu ⚙️ → la position du joueur s'affiche avec les FPS (« Afficher les FPS »). |
| `rot` | rotation en degrés (facultatif) |
| `scale` | échelle (facultatif) |
| `y` | décalage vertical (facultatif) |
| `blocks` | `false` pour pouvoir traverser le modèle (par défaut il bloque le joueur) |

Les modèles de `world/` gardent leurs textures et reçoivent l'éclairage toon du jeu
(`"keepMaterials": true` dans `models.json` pour garder les matériaux d'origine).

## `models.json` — réglages

```json
{
  "tree_oak":    { "scale": 1.2, "rotY": 0 },
  "statue_chat": { "scale": 1, "blocks": true },
  "lamp_post":   { "y": -0.05 }
}
```

`scale` (échelle), `rotY` (degrés), `y` (mètres), `ground` (`false` = garder l'origine du
fichier), `keepMaterials`, `blocks`.

## Exemple fourni

`world/statue_chat.glb` (une statue de chat sur son socle) est posée dans les Hautes Terres et
à l'entrée ouest de la ferme. Elle a été générée par `tools/make-example-model.mjs` : supprimez
le fichier et ses lignes de `placements.json` si vous n'en voulez pas.

## Créer des modèles depuis le téléphone

Le studio **SUPERESSENCE 3D** connecté à Claude peut modéliser puis exporter en `.glb` : il
suffit ensuite de l'envoyer dans ce dossier (étapes ci-dessus).
