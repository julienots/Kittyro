# Mossy Meadows — Design

**Pitch :** la vallée est un archipel de petits dioramas flottants au-dessus d'une mer de nuages.
Le joueur hérite d'une ferme presque vide et aide Willowbrook à renaître. Identité visuelle propre :
îles « tranches de gâteau » aux couches de terre visibles, rendu toon pastel peint, effet
tilt-shift miniature, personnages chibis à grosse tête, interface crème aux boutons arrondis.

Pas de romance : les relations sont des **amitiés** (feuilles 🍃 de 0 à 10).

## Boucle de jeu
Libre et sans pression : cultiver, élever, explorer, pêcher, miner, décorer, collectionner — dans
l'ordre qu'on veut. Aucune pénalité (s'endormir tard = réveil chez soi ; cultures hors saison en
dormance ; sac plein → remise). Une journée dure 12 minutes réelles ; les cultures continuent de
pousser pendant l'absence (plafonné).

## Contenu
| Domaine | Contenu |
|---|---|
| Régions | Green Valley (ferme), Willowbrook (village), **Clairefontaine (hameau à construire)**, Whispering Woods, Crystal Mountains + mines, Sunny Coast, Frosty Peaks, Ember Valley, maison |
| Cultures | 17 (dont blé, maïs, carotte, tomate, fraise, pomme de terre, citrouille, salade, myrtille, pastèque, tournesol, tulipe, rose, chou d'hiver, ail, clochette de givre, fleur de lune), 5 stades visuels, repousse, serre |
| Arbres fruitiers | pommier, cerisier, pêcher, oranger, citronnier |
| Animaux de ferme | poule, canard, lapin, vache, mouton, chèvre, cochon, cheval (monture), chat, chien (suit le joueur) |
| Animaux rares | renard, cerf, raton laveur, loutre, hérisson, panda lunaire — à apprivoiser, puis refuge |
| Créatures | 30 « Meadowkin » originales, 5 raretés, conditions météo/heure/saison, bestiaire |
| Pêche | 36 poissons (nuit, pluie, orage, hiver, zones, lave), mini-jeu tactile |
| Insectes | 20 |
| Ressources | bois, bois dur, pierre, argile, charbon, cuivre, fer, or, cristaux, améthyste, aigue-marine, givre, braisite, géodes, fossiles, cueillette par région/saison |
| Recettes | 25 plats avec bonus, 81 recettes au total (matériaux, agriculture, meubles, déco) |
| Bâtiments ferme | maison, poulailler, étable, écurie, refuge, silo, serre, moulin, atelier, cuisine, fourneau, laiterie, ruche, étang, remise |
| Décorations | 73 extérieures (10 catégories) + ~43 meubles, papiers peints et sols par pièce |
| Village | 10 bâtiments à restaurer, chacun débloque une fonction |
| PNJ | Moss, Mallow, Pippa, Niko, Bibi, Toma, Brie, Hazel — emplois du temps, dialogues, cadeaux, récompenses d'amitié |
| Quêtes | 20 quêtes d'histoire, 3 quotidiennes, 2 hebdomadaires, demandes des habitants |
| Fêtes | Fleurs, Lucioles, Marché des récoltes, Concours de pêche, Citrouilles, Neige, Arc-en-ciel |
| Mini-jeux | récolte, lanternes, marché, lancer d'anneaux, course de moutons, concours de pêche |
| Outils | houe, arrosoir, hache, pioche, canne, faucille — 5 niveaux (Bois → Cristal) aux effets réels |
| Économie | pièces, Moon Gems (gagnées en jeu), jetons de fête ; boutique cosmétique, Cozy Pass gratuit + Pass+ (en gemmes) — rien de payant, rien de pay-to-win |

## Contrôles mobiles
Joystick flottant (moitié gauche), toucher-pour-aller (avec interaction automatique sur la cible
touchée), bouton d'action contextuel (le bon outil est choisi automatiquement pour arbres/rochers/
herbes), bouton outil (appui long = roue d'outils), pinch pour zoomer, mode gaucher, choix du mode
de contrôle dans le menu.

## Clairefontaine — le hameau à construire (v1.1)
Une clairière sauvage au sud de la ferme (sentier + panneau). Le joueur y fonde son propre village :
- **16 bâtiments** : logements (cabane, chaumière, maison de pierre, grande demeure), lieux de travail
  (scierie, carrière, champs communaux, cabane de pêche, fournil, atelier de tissage, forge, rucher,
  taverne du Lapin Joyeux, halle du marché) et services (puits, kiosque à musique, statue du fondateur).
- **Villageois générés** (nom, apparence, trait de caractère) : chaque lit libre attire un voyageur au
  lever du jour (le premier arrive dès la première maison). Ils vivent une journée réglée : maison →
  travail → taverne/place le soir → maison (ils rentrent vraiment chez eux), s'abritent quand il pleut.
- **Bonheur** (logement, travail, puits, taverne, fournil, beauté des décorations, amitié, météo) →
  productivité et nouveaux arrivants. **Production** quotidienne dans le coffre du registre 📒.
- **Souhaits** (bulle 💭), cadeaux, métiers modifiables, 5 niveaux (Campement → Petite ville) qui
  débloquent les bâtiments, **11 objectifs guidés** avec récompenses.
- Nouveaux objets : poutre, pierre taillée, chaume, cire d'abeille, panier tressé ; plats : cidre,
  tourte du hameau, maïs grillé, ragoût de Clairefontaine ; décorations : pavés, lanterne bleue,
  bannière, massif de lavande, statue du renard.

## Vie & réalisme (v1.1)
Textures procédurales des bâtiments dans le shader (planches, briques, pierre, bardeaux, chaume,
rondins, crépi, pavés) sans fichier image ni draw call supplémentaire ; ombres de nuages qui
glissent sur le paysage ; volées d'oiseaux, mouettes sur la côte, moineaux qui s'envolent quand on
approche ; passants dans Willowbrook (plus nombreux à mesure que le village est restauré).

## Guidage (v1.1)
Chaque option du menu est expliquée, volumes en %, guide du jeu (5 chapitres), astuces contextuelles
affichées une seule fois (désactivables), carte de la vallée illustrée avec fiche de région.

## Caméra & construction (v1.2)
- **Caméra libre** : glisser le doigt hors du joystick (ou la souris) fait tourner la vue et change
  l'inclinaison ; boutons ⟲ ⟳ au-dessus des actions.
- **Vue à la première personne** (bouton 👁️, touche V) : regard au doigt, joystick dans la direction
  du regard, point de visée au centre, et **mains visibles** qui balancent à la marche, traînent
  derrière les mouvements de tête, respirent au repos et font les gestes des outils (hache, houe,
  arrosoir, canne…), cueillette et repas.
- **Placement libre** : le bâtiment suit le doigt en relatif (il ne se cache plus sous le doigt), la
  caméra le suit et défile au bord de l'écran, flèches case par case, **rotation de tous les bâtiments**
  (portes, animaux et villageois suivent), herbes/cailloux/souches dessous ramassés automatiquement,
  sélection plus tolérante en mode « Déplacer ».
