package com.mossymeadows.game;

/** Build without an ads SDK: every ad button stays hidden in the game. */
public class NoAds implements AdsBackend {
    @Override public boolean isAvailable() { return false; }
    @Override public boolean isReady(String kind) { return false; }
    @Override public void show(String kind, String requestId) { }
    @Override public boolean privacyOptionsRequired() { return false; }
    @Override public void showPrivacyOptions() { }
}
