# 📦 Dépôt de modèles 3D

Déposez ici vos propres modèles 3D : ils sont **intégrés automatiquement au jeu** au prochain
build (web, APK et AAB). Aucun code à écrire.

```
game/models/
├── override/        ← remplace un modèle du jeu (arbre, rocher, meuble, bâtiment…)
├── world/           ← modèles libres, placés où vous voulez avec placements.json
├── character/       ← player.glb : la base 3D riggée du personnage principal (ex. Tripo)
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

> Les animaux et les PNJ ne sont pas remplaçables. Le personnage principal, lui, l'est : voir
> `character/` ci-dessous.

## `character/` — le personnage principal (base Tripo + personnalisation du jeu)

Déposez **`character/player.glb`** : un personnage **riggé** (avec squelette). Il remplace le corps
du héros partout (jeu, créateur au démarrage, garde-robe, autres joueurs en local). Le jeu garde la
main sur tout le reste :

- **animations** : marche, course, saut, nage, outils, pêche, émotes… sont celles du jeu,
  appliquées au squelette (n'importe quels noms d'os façon Mixamo/Tripo, T-pose ou A-pose : les bras
  sont redescendus automatiquement) ;
- **créateur** : couleur de peau, couleurs du haut, du bas et des chaussures sont re-teintées en
  direct, les **coiffures, chapeaux et accessoires de tête** du jeu se posent sur la tête, la taille
  s'applique. (Formes des vêtements, yeux et visage : ceux du modèle.)

Pour que la re-teinte marche, le modèle doit porter des **couleurs neutres** : peau pêche, haut
**blanc**, bas **gris moyen**, chaussures **noires**, et être **sans cheveux** (le jeu ajoute les
siens). C'est exactement ce que demande le prompt ci-dessous.

### Prompt Tripo (texte → 3D)

```
Full-body stylized 3D game character for a cozy farming game, chibi-leaning proportions
(head about one quarter of total height), friendly young adult, gender-neutral, standing in a
strict T-pose, arms straight out to the sides, palms down, feet slightly apart, facing forward.
Smooth bald head with no hair, no hat, no helmet. Simple cute face: large round dark eyes,
small nose, gentle smile, soft cheeks. Plain fitted short-sleeve crew-neck t-shirt in pure
white, plain straight trousers in flat medium grey, simple rounded sneakers in solid black,
bare arms and hands with five fingers. Skin tone warm peach (#F2C4A0). Flat matte colours,
no patterns, no logos, no text, no accessories, no belt, no backpack. Clean low-poly hand-
painted toon look, smooth surfaces, symmetrical, single character, no base, no ground.
```

**Prompt négatif** (si disponible) : `hair, hat, long sleeves, jacket, dress, skirt, cape, patterns,
logo, text, weapon, props, base, pedestal, A-pose with bent arms, multiple characters, realistic
skin pores`

### Réglages Tripo

1. Génération : style *Cartoon* / stylisé, **texture activée**, qualité haute ; si l'option existe,
   *Smart low poly* ou ≈ 10 000 – 30 000 triangles.
2. Si le résultat a des cheveux ou un chapeau : régénérez (ou mettez `"hair": false` ci-dessous
   pour garder ceux du modèle).
3. **Rig** → squelette *humanoïde* (biped). Inutile d'ajouter des animations : le jeu anime.
4. **Export** → format **GLB**, avec le rig (skinned), textures intégrées, pas de compression
   Draco.
5. Renommez le fichier **`player.glb`** et envoyez-le dans `game/models/character/`.

### Ajustements (`models.json`)

```json
{
  "player": {
    "height": 1.32,
    "rotY": 0,
    "hair": true,
    "hairOffset": [0, 0, 0],
    "hairScale": 1,
    "refSkin": "#f2c4a0",
    "topMax": 0.76,
    "bottomMax": 0.55,
    "shoesMax": 0.1
  }
}
```

| Clé | Rôle |
|---|---|
| `height` | taille en mètres (1,32 = le héros d'origine) |
| `rotY` | si le personnage regarde dans la mauvaise direction : `180` |
| `hair` | `false` si le modèle a ses propres cheveux (les coiffures du jeu ne sont plus ajoutées) |
| `hairOffset`, `hairScale` | décaler / agrandir coiffures et chapeaux sur la tête (mètres) |
| `refSkin` | couleur de peau réelle de la texture, pour que les teintes de peau soient justes |
| `recolor` | `false` pour garder les couleurs d'origine du modèle |
| `topMax`, `bottomMax`, `shoesMax` | hauteurs relatives (0 = pieds, 1 = sommet du crâne) où s'arrêtent le haut, le bas et les chaussures |

`tools/make-test-character.mjs` génère un mannequin riggé de test pour vérifier la chaîne.

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

Pour le personnage principal, utilisez Tripo (voir `character/`). Pour les objets, le studio **SUPERESSENCE 3D** connecté à Claude peut modéliser puis exporter en `.glb` : il
suffit ensuite de l'envoyer dans ce dossier (étapes ci-dessus).
