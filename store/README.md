# 🚀 Publier Mossy Meadows sur le Google Play Store

Tout ce qu'il faut est dans ce dossier et dans `builds/`. Il reste uniquement les étapes qui
demandent **votre** compte Google.

| Fichier | Rôle |
|---|---|
| `../builds/mossy-meadows-1.4.0-release.aab` | Bundle signé à envoyer (version **sans publicité**, voir §3) |
| `listing.md` | Nom, descriptions FR/EN, notes de version |
| `icon-512.png`, `feature-graphic.png`, `screenshots/` | Visuels de la fiche |
| `privacy-policy.html` | Politique de confidentialité FR/EN à héberger |
| `data-safety.md` | Réponses : sécurité des données, classification, public cible |

## 1. La clé (à lire absolument)

- `android/release.jks` + `android/release.properties` = **clé d'importation** (upload key).
  Alias `mossy`, RSA 4096, valable jusqu'en 2054. Elles ne sont **pas** dans Git (volontairement).
- **Sauvegardez-les** en 2 endroits sûrs (clé USB + gestionnaire de mots de passe/cloud privé).
  Ne les partagez jamais, ne les committez jamais.
- Empreintes de la clé d'importation (pour vérifier dans la Play Console) :
  ```
  SHA-1   : DF:3F:C0:89:9F:53:C4:E5:74:4F:9A:71:57:02:2A:B4:15:C5:15:2D
  SHA-256 : DD:F2:22:FF:53:AE:9C:BB:43:E9:F3:2D:09:6F:9C:6E:51:36:92:06:3F:E3:54:D0:5E:F0:36:B2:1C:D9:8D:34
  ```
  (`keytool -list -v -keystore android/release.jks -alias mossy`)
- Avec **la signature d'application par Google Play** (activée par défaut), Google garde la clé
  finale ; si vous perdez la clé d'importation, une réinitialisation est possible via le support
  Play Console. Sans sauvegarde, c'est quelques jours de blocage ; avec, aucun souci.

## 2. Play Console, pas à pas

1. Créer un compte développeur : <https://play.google.com/console/signup> (25 $ une fois, pièce d'identité).
   Compte **personnel** créé après nov. 2023 : un **test fermé avec 12 testeurs pendant 14 jours**
   est obligatoire avant la production.
2. *Créer une application* → nom « Mossy Meadows : Ferme Cozy », langue par défaut Français,
   **Jeu**, **Gratuit**, accepter les déclarations.
3. *Configuration de l'application* → remplir avec `data-safety.md` :
   politique de confidentialité (URL, §4), accès à l'app, annonces, classification du contenu,
   public cible, sécurité des données, ID publicitaire, catégorie Simulation, coordonnées.
4. *Fiche Play Store principale* → copier `listing.md`, importer icône, image de présentation et
   captures (`screenshots/`, valables téléphone + tablette 7"/10").
5. *Tests → Test fermé* (ou *Test interne* pour essayer d'abord) → *Créer une version* →
   accepter la signature par Google Play → importer l'AAB → notes de version → déployer.
6. Après les 14 jours de test fermé : *Production* → *Promouvoir la version* → envoyer en examen
   (quelques heures à 7 jours).

## 3. Publicités : deux builds

**Le jeu est prêt pour les pubs** (bouton 📺 « Gratuit » dans la boutique, +3 💎, doubler les gains,
production express du hameau, points de pass, pubs interstitielles rares et espacées,
consentement RGPD). Mais le SDK Google AdMob doit être téléchargé depuis `dl.google.com`, qui est
bloqué dans l'environnement où ce build a été fait. Donc :

- `builds/mossy-meadows-1.4.0-release.aab` = **sans publicité** (boutons pub masqués). Publiable
  tel quel ; déclarez « pas d'annonces » et « aucune donnée collectée ».
- **Version avec pubs** = workflow GitHub Actions `Android release (AdMob)` :
  1. Créer un compte <https://admob.google.com>, ajouter l'app Android (après sa mise en ligne,
     ou « non publiée » avant), créer 2 blocs d'annonces : **Avec récompense** et **Interstitiel**.
     Pour la récompense, mettre 1 « Récompense » (le jeu choisit lui-même le cadeau).
  2. Dans GitHub → *Settings → Secrets and variables → Actions*, ajouter :
     | Secret | Valeur |
     |---|---|
     | `KEYSTORE_BASE64` | sortie de `base64 -w0 android/release.jks` |
     | `KEYSTORE_PASSWORD` | `storePassword` de `android/release.properties` |
     | `ADMOB_APP_ID` | `ca-app-pub-…~…` (ID d'application) |
     | `ADMOB_REWARDED_ID` | `ca-app-pub-…/…` (bloc avec récompense) |
     | `ADMOB_INTERSTITIAL_ID` | `ca-app-pub-…/…` (bloc interstitiel) |
  3. Onglet *Actions* → *Android release (AdMob)* → *Run workflow* (ou pousser un tag `v1.4.0`).
     L'AAB signé est dans l'artefact `mossy-meadows-play-store`.
  4. Dans AdMob → *Confidentialité et messagerie* → créer le message **RGPD** (obligatoire en Europe)
     et publier ; le jeu l'affiche automatiquement au 1er lancement.
  5. Publier `app-ads.txt` (ligne fournie par AdMob) à la racine du site déclaré dans la fiche Play.
  6. Si la version sans pub a déjà été envoyée avec le code 10400, relancez avec un code plus
     grand : `gradle bundleRelease -PVERSION_CODE=10401 …` (ou passez le jeu en 1.4.1).
  7. Dans la Play Console, mettre à jour : *Annonces = Oui*, *Sécurité des données* et
     *ID publicitaire* selon `data-safety.md`.

  ⚠️ Sans les secrets AdMob, le workflow utilise les **ID de test** de Google : pubs factices, à ne
  jamais publier. Ce build Gradle n'a pas pu être compilé ici (SDK inaccessible) : testez l'AAB
  produit en *Test interne* avant la production.

  Pour qu'il soit construit directement ici : autoriser `dl.google.com` et `maven.google.com`
  dans l'accès réseau de l'environnement Claude Code.

Tester les pubs dans le navigateur : `http://localhost:5173/?ads=test` (fausse pub de 5 s).

## 4. Héberger la politique de confidentialité

Remplacer `[ADRESSE E-MAIL DE CONTACT]` / `[CONTACT EMAIL ADDRESS]` par votre e-mail de contact,
puis au choix :
- **GitHub Pages** : *Settings → Pages* → branche `main`, dossier `/ (root)` →
  URL `https://<utilisateur>.github.io/Kittyro/store/privacy-policy.html` (dépôt public requis
  sur un compte gratuit) ;
- ou Google Sites / tout hébergeur : coller le contenu de la page.

## 5. Mises à jour futures

Augmenter `version` dans `game/package.json` (le `versionCode` = majeur×10000 + mineur×100 + patch),
relancer `./android/build.sh` (ou le workflow), et envoyer le nouvel AAB. Toujours avec la **même**
clé `release.jks`.
