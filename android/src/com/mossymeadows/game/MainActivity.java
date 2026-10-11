package com.mossymeadows.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.charset.Charset;

/**
 * Mossy Meadows Android shell: a fullscreen, hardware accelerated WebView that
 * serves the game from APK assets on a private https origin, plus a small
 * native bridge for robust (atomic) save files in app storage.
 */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.mossymeadows.local/";
    private WebView web;
    private AdsBackend ads = new NoAds();

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        w.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        if (Build.VERSION.SDK_INT >= 28) {
            // layoutInDisplayCutoutMode = SHORT_EDGES (1), set reflectively to compile against older SDKs
            try {
                WindowManager.LayoutParams lp = w.getAttributes();
                WindowManager.LayoutParams.class.getField("layoutInDisplayCutoutMode").setInt(lp, 1);
                w.setAttributes(lp);
            } catch (Exception ignored) {
            }
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(159, 216, 255));
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setTextZoom(100);
        web.addJavascriptInterface(new NativeBridge(), "MossyNative");
        ads = createAds();
        web.addJavascriptInterface(new AdsBridge(), "MossyAds");
        registerBackCallback();
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (!url.startsWith(ORIGIN)) return null;
                String path = url.substring(ORIGIN.length());
                int q = path.indexOf('?');
                if (q >= 0) path = path.substring(0, q);
                if (path.isEmpty()) path = "index.html";
                try {
                    InputStream in = getAssets().open("www/" + path, AssetManager.ACCESS_STREAMING);
                    return new WebResourceResponse(mime(path), "UTF-8", in);
                } catch (Exception e) {
                    return null;
                }
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !url.startsWith(ORIGIN);
            }
        });
        setContentView(web);
        hideSystemUi();
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(ORIGIN + "index.html");
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    protected void onPause() {
        // ask the game to save before the app goes to the background
        if (web != null) web.evaluateJavascript("window.__game && window.__game.save && window.__game.save()", null);
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        hideSystemUi();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Back button: close panels / open the menu instead of quitting abruptly.
        backToGame();
    }

    private void backToGame() {
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", null);
    }

    /**
     * Android 13+ (and mandatory when targeting Android 16): back gestures go through
     * OnBackInvokedDispatcher instead of onBackPressed(). Registered by reflection so the
     * shell still compiles against older SDKs.
     */
    private void registerBackCallback() {
        if (Build.VERSION.SDK_INT < 33) return;
        try {
            Object dispatcher = getClass().getMethod("getOnBackInvokedDispatcher").invoke(this);
            Class<?> cb = Class.forName("android.window.OnBackInvokedCallback");
            Object callback = Proxy.newProxyInstance(cb.getClassLoader(), new Class<?>[]{cb}, new InvocationHandler() {
                @Override
                public Object invoke(Object proxy, Method method, Object[] args) {
                    if ("onBackInvoked".equals(method.getName())) backToGame();
                    else if ("hashCode".equals(method.getName())) return System.identityHashCode(proxy);
                    else if ("equals".equals(method.getName())) return proxy == args[0];
                    return null;
                }
            });
            dispatcher.getClass().getMethod("registerOnBackInvokedCallback", int.class, cb).invoke(dispatcher, 0, callback);
        } catch (Throwable ignored) {
        }
    }

    /** The AdMob build ships AdMobBackend; the plain build falls back to NoAds. */
    private AdsBackend createAds() {
        try {
            Class<?> c = Class.forName("com.mossymeadows.game.AdMobBackend");
            return (AdsBackend) c.getConstructor(MainActivity.class).newInstance(this);
        } catch (Throwable t) {
            return new NoAds();
        }
    }

    /** Called by the ads backend when a full-screen ad closes. */
    void adDone(final String requestId, final boolean rewarded) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                hideSystemUi();
                if (web != null) web.evaluateJavascript("window.__mossyAdDone && window.__mossyAdDone('" + requestId + "'," + rewarded + ")", null);
            }
        });
    }

    /** JavaScript side of the ads (window.MossyAds). */
    private class AdsBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return ads.isAvailable();
        }

        @JavascriptInterface
        public boolean isReady(String kind) {
            return ads.isReady(kind);
        }

        @JavascriptInterface
        public void show(final String kind, final String requestId) {
            if (requestId == null || !requestId.matches("[A-Za-z0-9_]{1,32}")) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    ads.show(kind, requestId);
                }
            });
        }

        @JavascriptInterface
        public boolean privacyOptionsRequired() {
            return ads.privacyOptionsRequired();
        }

        @JavascriptInterface
        public void showPrivacyOptions() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    ads.showPrivacyOptions();
                }
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Atomic save files: write to a temp file, then rename over the old one. */
    private class NativeBridge {
        private final Charset utf8 = Charset.forName("UTF-8");

        private File file(String name) {
            String safe = name.replaceAll("[^A-Za-z0-9_\\-]", "_");
            File dir = new File(getFilesDir(), "saves");
            if (!dir.exists()) dir.mkdirs();
            return new File(dir, safe + ".json");
        }

        @JavascriptInterface
        public boolean saveFile(String name, String data) {
            File target = file(name);
            File tmp = new File(target.getPath() + ".tmp");
            try {
                FileOutputStream out = new FileOutputStream(tmp);
                out.write(data.getBytes(utf8));
                out.getFD().sync();
                out.close();
                return tmp.renameTo(target);
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String loadFile(String name) {
            File f = file(name);
            if (!f.exists()) return null;
            try {
                FileInputStream in = new FileInputStream(f);
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
                in.close();
                return new String(bos.toByteArray(), utf8);
            } catch (Exception e) {
                return null;
            }
        }

        @JavascriptInterface
        public boolean deleteFile(String name) {
            return file(name).delete();
        }
    }
}
