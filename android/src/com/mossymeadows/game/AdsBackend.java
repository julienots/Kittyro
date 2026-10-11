package com.mossymeadows.game;

/**
 * Ad provider seen by the game through the "MossyAds" JavaScript interface.
 * The plain build uses {@link NoAds}; the AdMob build (Gradle project in
 * android/gradle, sources in android/admob) provides AdMobBackend, picked up
 * by reflection so this core never depends on the ads SDK.
 */
public interface AdsBackend {
    boolean isAvailable();

    boolean isReady(String kind);

    /** Show a "rewarded" or "interstitial" ad, then call MainActivity.adDone(requestId, rewarded). */
    void show(String kind, String requestId);

    boolean privacyOptionsRequired();

    void showPrivacyOptions();
}
