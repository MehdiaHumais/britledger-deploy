package com.britledger.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Handle PDF URLs within WebView - don't let external apps hijack
                if (url.contains(".pdf") || url.contains("/pdf") || url.contains("blob:")) {
                    view.loadUrl(url);
                    return true;
                }
                // Handle all URLs within WebView - stop external app hijacking
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Prevent external navigation
                view.evaluateJavascript(
                    "document.querySelectorAll('a[target=\"_blank\"]').forEach(function(a) {" +
                    "   a.removeAttribute('target');" +
                    "   a.addEventListener('click', function(e) {" +
                    "       e.preventDefault();" +
                    "       window.location.href = a.href;" +
                    "   });" +
                    "});" +
                    "document.querySelectorAll('[href]').forEach(function(a) {" +
                    "   if(a.href && !a.href.startsWith('http')) { return; }" +
                    "   a.addEventListener('click', function(e) {" +
                    "       if(a.href && a.href !== window.location.href) {" +
                    "           e.preventDefault();" +
                    "           window.location.href = a.href;" +
                    "       }" +
                    "   });" +
                    "});" +
                    "if(window.opener) { window.opener = null; }",
                    null
                );
            }
        });

        getBridge().getWebView().getSettings().setAllowFileAccess(true);
        getBridge().getWebView().getSettings().setAllowContentAccess(true);
        getBridge().getWebView().getSettings().setDomStorageEnabled(true);
        getBridge().getWebView().getSettings().setJavaScriptEnabled(true);
        getBridge().getWebView().getSettings().setMixedContentMode(0);
        getBridge().getWebView().getSettings().setUseWideViewPort(true);
        getBridge().getWebView().getSettings().setLoadWithOverviewMode(true);
        getBridge().getWebView().getSettings().setBuiltInZoomControls(false);
        getBridge().getWebView().getSettings().setSupportMultipleWindows(false);
    }

    @Override
    public void onBackPressed() {
        WebView wv = getBridge().getWebView();
        if (wv != null && wv.canGoBack()) {
            String url = wv.getUrl();
            // If on login page or could be first page, close the app
            if (url != null && (url.contains("/login") || url.contains("signin"))) {
                finishAffinity();
                return;
            }
            // Try to go back in WebView history
            wv.goBack();
        } else {
            finishAffinity();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            WebView wv = getBridge().getWebView();
            if (wv != null && wv.canGoBack()) {
                String url = wv.getUrl();
                if (url != null && (url.contains("/login") || url.contains("signin"))) {
                    finishAffinity();
                    return true;
                }
                wv.goBack();
                return true;
            } else {
                finishAffinity();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }
}
