package com.britledger.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private String initialUrl = "";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView wv = getBridge().getWebView();

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false;
                }
                view.loadUrl(url);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (initialUrl.isEmpty()) {
                    initialUrl = url;
                }
            }
        });

        wv.getSettings().setAllowFileAccess(true);
        wv.getSettings().setAllowContentAccess(true);
        wv.getSettings().setDomStorageEnabled(true);
        wv.getSettings().setJavaScriptEnabled(true);
        wv.getSettings().setMixedContentMode(0);
        wv.getSettings().setUseWideViewPort(true);
        wv.getSettings().setLoadWithOverviewMode(true);
        wv.getSettings().setBuiltInZoomControls(false);
        wv.getSettings().setSupportMultipleWindows(false);
    }

    @Override
    public void onBackPressed() {
        WebView wv = getBridge().getWebView();
        if (wv != null) {
            String url = wv.getUrl() != null ? wv.getUrl() : "";
            // If on dashboard or main pages, close app
            if (url.contains("/dashboard") || url.contains("/login") || url.equals(initialUrl) || !wv.canGoBack()) {
                finishAffinity();
            } else {
                wv.goBack();
            }
        } else {
            finishAffinity();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                String url = wv.getUrl() != null ? wv.getUrl() : "";
                if (url.contains("/dashboard") || url.contains("/login") || url.equals(initialUrl) || !wv.canGoBack()) {
                    finishAffinity();
                } else {
                    wv.goBack();
                }
            } else {
                finishAffinity();
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }
}
