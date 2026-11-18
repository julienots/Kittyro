# Guide complet : publier Mossy Meadows sur Google Play, de A à Z

> Google change parfois le nom ou la place des boutons. Si un bouton n'est pas exactement là,
> cherche le libellé le plus proche, ou passe par **Tableau de bord** : la liste
> « Configurer votre application » contient un lien direct vers chaque formulaire.

Fichiers utilisés (dossier `store/` et `builds/`) :
`mossy-meadows-1.4.0-release.aab`, `listing.md`, `icon-512.png`, `feature-graphic.png`,
`screenshots/01…06.png`, et le lien de ta politique de confidentialité.

---

## PARTIE A : créer le compte développeur

1. Sur ton ordinateur (c'est plus simple que sur téléphone), va sur **https://play.google.com/console/signup**.
2. Connecte-toi avec le compte Google qui sera **propriétaire** du jeu. Utilise-le pour toujours.
3. « Choisissez un type de compte » : clique **Vous-même** (compte personnel), puis **Commencer**.
4. **Nom du développeur** : le nom public affiché sous le jeu (ex. `Mossy Studio`).
5. **Profil de paiement** : clique **Créer un profil de paiement**. Tape ton nom, ton adresse et ton pays, puis **Envoyer**.
6. **Coordonnées** :
   - e-mail de contact (vérifié par un code envoyé par mail) ;
   - numéro de téléphone (vérifié par SMS) ;
   - e-mail public pour les joueurs.
7. **À propos de vous** : réponds honnêtement. Expérience Android : peu. Nombre d'applis : 1. Gagner de l'argent : Oui, publicités.
8. Coche les conditions, puis **Créer un compte et payer**. Paie **25 $**, une seule fois.
9. **Valider ton identité** : sur l'accueil, clique **Valider votre identité**. Envoie une photo de ta carte d'identité ou de ton passeport. Le nom doit être exactement celui du profil de paiement. Réponse en 1 à 3 jours.
10. **Valider un appareil Android** : quand Google le demande, installe l'appli **Google Play Console** sur ton téléphone Android. Connecte-toi avec le même compte et suis le message.

Tant que l'identité n'est pas validée, tu peux préparer l'app, mais tu ne pourras pas publier.

---

## PARTIE B : créer l'application

1. Menu de gauche **Accueil**, puis bouton bleu **Créer une application**.
2. Remplis :
   - **Nom de l'application** : `Mossy Meadows : Ferme Cozy`
   - **Langue par défaut** : `Français – fr-FR`
   - **Application ou jeu** : **Jeu**
   - **Sans frais ou payante** : **Sans frais**. Attention : ce choix est définitif.
3. **Déclarations** : coche les cases « Règles du programme pour les développeurs » et « Lois sur l'exportation des États-Unis ».
4. Clique **Créer l'application**. Tu arrives sur le **Tableau de bord** du jeu.

---

## PARTIE C : formulaires « Contenu de l'application »

Va dans **Tableau de bord**, section **Configurer votre application**. Clique chaque tâche, l'une après l'autre. Tu les retrouves aussi dans le menu **Règles et programmes → Contenu de l'application**.

> Les réponses ci-dessous sont pour l'AAB **sans pub** (celui déjà fourni). Si tu envoies plus tard
> la version **avec pubs**, il faudra revenir modifier 3 formulaires : C3, C6 et C7 (voir PARTIE G).

### C1. Politique de confidentialité
1. Clique **Définir la politique de confidentialité**.
2. Colle l'URL de ta page (ex. ton site Google Sites).
3. Clique **Enregistrer**.

### C2. Accès à l'application
1. Clique **Accès à l'application**.
2. Choisis **Toutes les fonctionnalités de mon application sont disponibles sans aucune restriction d'accès**.
3. Clique **Enregistrer**.

### C3. Annonces
1. Clique **Annonces**.
2. Choisis **Non, mon application ne contient pas d'annonces**. Pour la version avec pubs : **Oui**.
3. Clique **Enregistrer**.

### C4. Classification du contenu
1. Clique **Classification du contenu**, puis **Commencer le questionnaire**.
2. **Adresse e-mail** : ton e-mail.
3. **Catégorie** : **Jeu** (« Jeux » ou « Toutes les autres catégories – Jeu » selon l'affichage). Coche l'acceptation des conditions IARC. Clique **Suivant**.
4. Réponds **Non** à toutes ces questions :
   - violence, sang ;
   - peur ;
   - sexualité, nudité ;
   - langage grossier ;
   - drogues, alcool, tabac ;
   - jeux d'argent ou de hasard ;
   - interaction entre utilisateurs, partage d'informations ou de position ;
   - achats numériques ;
   - navigateur web ou moteur de recherche ;
   - contenu généré par les utilisateurs.
5. Clique **Enregistrer**, puis **Suivant**. Vérifie le résultat attendu : **PEGI 3 / Tout public**.
6. Clique **Envoyer**.

### C5. Public cible et contenu
1. **Tranche d'âge cible** : coche **13-15 ans**, **16-17 ans** et **18 ans et plus**. Ne coche **pas** les moins de 13 ans : ça imposerait des règles spéciales pour les pubs.
2. Clique **Suivant**.
3. « L'application pourrait-elle attirer involontairement les enfants ? » : **Non**. Clique **Suivant**.
4. Clique **Enregistrer**.

### C6. Sécurité des données
1. Clique **Sécurité des données**, puis **Suivant** sur la page de présentation.
2. « Votre application collecte-t-elle ou partage-t-elle des types de données utilisateur requis ? » :
   - **Sans pub** : **Non**. Clique **Suivant**, puis **Enregistrer**. C'est fini.
   - **Avec pubs** : **Oui**, puis :
     1. « Données chiffrées en transit ? » : **Oui**.
     2. Moyen de demander la suppression : choisis l'option qui dit que tu n'en proposes pas (pas de compte).
     3. **Suivant**. Coche ces types de données :
        - **Position approximative** ;
        - **ID de l'appareil ou autres ID** ;
        - **Interactions avec l'application** ;
        - **Journaux de plantage** ;
        - **Diagnostics**.
     4. **Suivant**. Pour **chaque** type coché, clique la flèche et réponds :
        - Collectées : **Oui**. Partagées : **Oui**.
        - Traitées de façon éphémère : **Non**.
        - Collecte obligatoire : **Oui**, les utilisateurs ne peuvent pas la désactiver.
        - Finalités : **Publicité ou marketing**, **Analyse** et **Prévention des fraudes, sécurité et conformité**.
     5. Clique **Enregistrer**.

### C7. Identifiant publicitaire
1. « Votre application utilise-t-elle un identifiant publicitaire ? » : **Non** pour la version sans pub.
2. Pour la version avec pubs : **Oui**, puis coche **Publicité ou marketing** et **Analyse**.
3. Clique **Enregistrer**.

### C8. Autres déclarations
Réponds **Non** (ou « aucune ») à chacune, puis clique **Enregistrer** :
- **Applications gouvernementales** : Non.
- **Fonctionnalités financières** : « Mon application ne propose aucune fonctionnalité financière ».
- **Santé** : rien à cocher.
- **Applications d'actualités** : Non.

---

## PARTIE D : fiche Play Store (ce que voient les joueurs)

### D1. Paramètres
1. Menu de gauche : **Accroître le nombre d'utilisateurs → Présence sur le Play Store → Paramètres de la fiche Play Store** (ou la tâche « Choisir une catégorie et fournir les coordonnées »).
2. **Application ou jeu** : **Jeu**. **Catégorie** : **Simulation**.
3. **Tags** : clique **Gérer les tags**, coche par exemple **Agriculture**, **Construction**, **Décontracté**, **Hors connexion**, puis **Appliquer**.
4. **Adresse e-mail** : ton e-mail de contact public. Téléphone et site web : facultatifs.
5. Clique **Enregistrer**.

### D2. Fiche principale
1. Menu : **Présence sur le Play Store → Fiche Play Store principale**.
2. Copie depuis `listing.md` :
   - **Nom de l'application** : `Mossy Meadows : Ferme Cozy`
   - **Description courte** : la ligne de 80 caractères
   - **Description complète** : le grand texte
3. **Icône de l'application** : clique **Importer**, puis choisis `icon-512.png`.
4. **Image de présentation** : clique **Importer**, puis choisis `feature-graphic.png`.
5. **Captures d'écran pour téléphone** : clique **Importer** et ajoute les 6 images de `screenshots/`. Il en faut au moins 2.
6. **Tablette 7 pouces** et **Tablette 10 pouces** : ajoute les mêmes 6 images. C'est facultatif, mais ça montre le jeu aux tablettes.
7. Laisse la vidéo vide.
8. Clique **Enregistrer** en bas à droite.
9. *(Facultatif)* **Traductions** : en haut de la page, clique **Gérer les traductions → Ajouter vos propres traductions**. Coche **Anglais (États-Unis) – en-US**, puis colle la partie anglaise de `listing.md`.

---

## PARTIE E : test fermé (obligatoire : 12 testeurs, 14 jours)

### E1. Choisir les pays
1. Menu : **Tester et publier → Tests → Tests fermés**.
2. Sur le canal **Alpha** (ou « Test fermé »), clique **Gérer le canal**.
3. Onglet **Pays/régions**, puis **Ajouter des pays/régions**.
4. Coche **France** (ou tous les pays), puis **Ajouter**, puis **Enregistrer**.

### E2. Ajouter les testeurs
1. Onglet **Testeurs**, puis **Créer une liste de diffusion**.
2. Nom : `Amis`. Colle au moins **12 adresses Gmail**, séparées par des virgules.
3. Clique **Enregistrer les modifications**.
4. Coche la liste **Amis**. **URL ou adresse e-mail de commentaires** : ton e-mail.
5. Clique **Enregistrer**.

### E3. Envoyer le jeu
1. Onglet **Versions** (ou bouton **Créer une version**).
2. **Signature d'application par Google Play** : clique **Choisir une clé de signature**, puis **Utiliser une clé générée par Google**. Clique **Continuer** ou **Accepter**.
   - Google garde la clé finale. Ta clé `release.jks` sert seulement à **envoyer** les mises à jour.
3. **App bundles** : clique **Importer**, puis choisis **`mossy-meadows-1.4.0-release.aab`**. Attends la coche verte.
   - Si un message d'erreur apparaît, fais une capture et envoie-la-moi.
4. **Nom de la version** : laisse `10400 (1.4.0)`.
5. **Notes de version** : efface le contenu et colle :
   ```
   <fr-FR>
   Première version de Mossy Meadows ! Cultive, explore et fonde ton village.
   </fr-FR>
   ```
6. Clique **Suivant**. Lis les avertissements : les jaunes sont normaux, seuls les rouges bloquent.
7. Clique **Enregistrer et publier**, ou **Envoyer pour examen**, puis confirme.
8. L'examen de Google prend de quelques heures à quelques jours.

### E4. Inviter les testeurs
1. Reviens dans **Tests fermés → Gérer le canal → onglet Testeurs**.
2. En bas, sous **Rejoindre le test**, clique **Copier le lien**.
3. Envoie ce lien aux 12 testeurs (WhatsApp, SMS…). Chacun doit :
   1. ouvrir le lien avec **le compte Gmail que tu as mis dans la liste** ;
   2. cliquer **Devenir testeur** ;
   3. cliquer **Télécharger sur Google Play** et installer le jeu ;
   4. **garder le jeu installé et inscrit pendant 14 jours d'affilée**. L'ouvrir de temps en temps aide.

---

## PARTIE F : passer en production (après 14 jours)

1. Sur **Tableau de bord**, la carte « Demander l'accès à la production » se débloque. Clique **Demander l'accès à la production**.
2. Réponds au questionnaire en quelques phrases simples :
   - comment tu as recruté les testeurs (amis et famille) ;
   - les retours reçus ;
   - ce que tu as corrigé ;
   - pourquoi le jeu est prêt.
3. Clique **Envoyer**. Google répond en quelques jours.
4. Une fois accepté :
   1. Va dans **Tester et publier → Production → Pays/régions → Ajouter des pays/régions**. Choisis les pays, puis **Enregistrer**.
   2. Onglet **Versions**, puis **Créer une version**.
   3. Clique **Ajouter depuis la bibliothèque**, choisis la version testée, puis **Ajouter à la version**.
   4. Ajoute les notes de version (comme en E3).
   5. Clique **Suivant**, puis **Enregistrer et publier**, ou **Envoyer pour examen**.
5. Après l'examen (quelques heures à 7 jours), le jeu est **en ligne** sur le Play Store. 🎉

---

## PARTIE G : passer à la version avec pubs (quand AdMob est prêt)

1. Récupère l'AAB avec pubs. Pour le fabriquer, suis l'étape 5 de `README.md` : AdMob, secrets GitHub, puis **Run workflow** avec `version_code` = `10401`.
2. Envoie-le comme une nouvelle version :
   1. **Tests fermés → Créer une version** (ou **Production → Créer une version** si tu es déjà en production).
   2. **Importer**, puis choisis le nouvel AAB.
   3. Ajoute les notes de version, puis **Suivant**, puis **Enregistrer et publier**.
3. Modifie 3 formulaires dans **Règles et programmes → Contenu de l'application** :
   - **Annonces** : **Oui**.
   - **Sécurité des données** : réponses « Avec pubs » de C6.
   - **Identifiant publicitaire** : **Oui**.
4. Dans **AdMob → Applications → ton app → Paramètres de l'application**, clique **Associer à une plate-forme d'applications** et choisis ton jeu Google Play, une fois qu'il est publié.

---

## Mises à jour futures
Demande-moi la nouvelle version. Je fabrique un AAB avec un numéro plus grand. Ensuite :
**Production → Créer une version → Importer → Notes → Suivant → Enregistrer et publier.**
Utilise toujours la même clé `release.jks`.
