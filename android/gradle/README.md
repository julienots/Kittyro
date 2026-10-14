# Build Android avec publicités (AdMob)

Le build « sans pub » se fait sans Gradle avec `../build.sh`. Ce projet Gradle produit la
version **avec AdMob** (pubs récompensées + interstitiels rares + formulaire de consentement RGPD).

Il faut un accès Internet à `dl.google.com` / `maven.google.com` (SDK Google Mobile Ads).

```bash
cd game && npm ci && npm run build && cd ..
mkdir -p android/gradle/app/src/main/assets/www && cp game/dist/index.html android/gradle/app/src/main/assets/www/
cd android/gradle
gradle bundleRelease \
  -PADMOB_APP_ID=ca-app-pub-XXXXXXXX~YYYYYYYY \
  -PADMOB_REWARDED_ID=ca-app-pub-XXXXXXXX/RRRRRRRR \
  -PADMOB_INTERSTITIAL_ID=ca-app-pub-XXXXXXXX/IIIIIIII
# -> app/build/outputs/bundle/release/app-release.aab (signé avec android/release.jks)
```

Sans `-PADMOB_*`, ce sont les identifiants **de test** de Google : parfait pour essayer, mais à
remplacer par les vôtres avant publication (sinon aucune rémunération, et c'est contraire aux règles).

Le workflow GitHub Actions `.github/workflows/android-release.yml` fait tout cela automatiquement.
