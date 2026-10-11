# Play Console — formulaires « Contenu de l'application »

## Sécurité des données (Data safety)

### Build AVEC publicités (AAB produit par GitHub Actions / Gradle, SDK AdMob)

| Question | Réponse |
|---|---|
| L'application collecte-t-elle ou partage-t-elle des types de données requis ? | **Oui** |
| Toutes les données sont-elles chiffrées en transit ? | **Oui** |
| Les utilisateurs peuvent-ils demander la suppression des données ? | **Non** (aucun compte ; le jeu ne stocke rien sur un serveur — l'ID publicitaire se réinitialise dans Android) |

Types de données à cocher (déclarés par le SDK Google Mobile Ads, cf. [doc Google](https://developers.google.com/admob/android/privacy/play-data-disclosure)) :

| Catégorie | Type | Collecté | Partagé | Facultatif ? | Finalités |
|---|---|---|---|---|---|
| Position | Position approximative | Oui | Oui | Non (obligatoire) | Publicité ou marketing, Analyse |
| Identifiants de l'appareil ou autres | ID d'appareil (ID publicitaire) | Oui | Oui | Non | Publicité ou marketing, Analyse, Prévention de la fraude/sécurité |
| Activité dans l'application | Interactions avec l'application | Oui | Oui | Non | Publicité ou marketing, Analyse |
| Infos et performances de l'application | Journaux de plantage, Diagnostics, Autres données de performances | Oui | Oui | Non | Analyse, Prévention de la fraude/sécurité |

Traitement éphémère : **Non**.

Rubrique « Identifiant publicitaire » (Contenu de l'application) : **Oui, l'application utilise l'ID publicitaire** → cocher *Publicité ou marketing* et *Analyse*.

### Build SANS publicités (AAB actuel produit par `android/build.sh`)

| Question | Réponse |
|---|---|
| L'application collecte-t-elle ou partage-t-elle des types de données requis ? | **Non** (pas de permission INTERNET, sauvegarde locale uniquement) |
| ID publicitaire | **Non** |

## Publicités
- « Votre application contient-elle des annonces ? » → **Oui** (build AdMob) / **Non** (build sans pub).

## Classification du contenu (questionnaire IARC)
Catégorie : **Jeu**. Réponses :
- Violence : **Non** (aucun combat ; on coupe des arbres et casse des pierres)
- Peur / horreur : **Non**
- Sexualité, nudité : **Non**
- Langage grossier : **Non**
- Substances (drogues, alcool, tabac) : **Non** — remarque : une *taverne* existe en décor ; aucune consommation montrée. Si vous voulez être prudent, répondez « références à l'alcool : oui, sans consommation » (impact : PEGI 7 / Teen éventuellement).
- Jeux d'argent / casino : **Non** (pas de mise d'argent réel ni simulé)
- Achats intégrés : **Non**
- Interaction entre utilisateurs / chat / partage de position : **Non**
- Contenu généré par les utilisateurs : **Non**

Résultat attendu : **PEGI 3 / ESRB Everyone / USK 0**.

## Public cible et contenu
- Tranches d'âge recommandées : **13–15, 16–17, 18+**.
  - Inclure des moins de 13 ans fait entrer l'app dans le programme *Familles* : publicités certifiées familles uniquement, contenu publicitaire `tagForChildDirectedTreatment`, et revue plus stricte. Le code actuel n'est pas configuré pour ça → **ne pas cocher les moins de 13 ans**.
- « L'application pourrait-elle attirer involontairement les enfants ? » → **Non** (style mignon mais public général ; mentionner « jeu cozy pour tous, non destiné spécifiquement aux enfants »). Google peut demander une justification.

## Autres déclarations
- Accès à l'application : **Toutes les fonctionnalités sont disponibles sans accès spécial** (pas de connexion).
- Application gouvernementale / financière / santé / VPN : **Non**.
- Actualités : **Non**.
- Politique de confidentialité : URL publique de `privacy-policy.html` (voir README).
