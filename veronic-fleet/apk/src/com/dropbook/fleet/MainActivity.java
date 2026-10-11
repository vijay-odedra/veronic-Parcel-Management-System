package com.dropbook.fleet;

import android.app.Activity;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.webkit.ValueCallback;

public class MainActivity extends Activity {
    public WebView webView;
    public ValueCallback<Uri[]> filePathCallback;
    public static final int FILECHOOSER_RESULTCODE = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(0xFF084C50);
            window.setNavigationBarColor(0xFF052A2D);
        }

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setTextZoom(100);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        webView.addJavascriptInterface(new PrintInterface(), "AndroidPrint");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.startsWith("file://") || url.contains("firebase") || url.contains("googleapis") || url.contains("gstatic"))) {
                    view.loadUrl(url);
                    return true;
                }
                return false;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, android.webkit.JsResult result) {
                result.confirm();
                return true;
            }
        });

        webView.loadUrl("file:///android_asset/login.html");
    }

    public class PrintInterface {
        @android.webkit.JavascriptInterface
        public void printHtml(final String htmlContent, final String jobTitle) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                        try {
                            final android.print.PrintManager printManager = (android.print.PrintManager) getSystemService(PRINT_SERVICE);
                            if (printManager != null) {
                                final WebView printWebView = new WebView(MainActivity.this);
                                printWebView.setWebViewClient(new WebViewClient() {
                                    @Override
                                    public void onPageFinished(WebView view, String url) {
                                        String name = (jobTitle != null && !jobTitle.isEmpty()) ? jobTitle : "DropBook_Bill";
                                        android.print.PrintDocumentAdapter printAdapter = view.createPrintDocumentAdapter(name);
                                        printManager.print(name, printAdapter, new android.print.PrintAttributes.Builder()
                                            .setMediaSize(android.print.PrintAttributes.MediaSize.ISO_A4)
                                            .build());
                                    }
                                });
                                printWebView.loadDataWithBaseURL("file:///android_asset/", htmlContent, "text/html", "UTF-8", null);
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void printPage(final String invoiceTitle) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                        try {
                            android.print.PrintManager printManager = (android.print.PrintManager) getSystemService(PRINT_SERVICE);
                            if (printManager != null && webView != null) {
                                String jobName = (invoiceTitle != null && !invoiceTitle.isEmpty()) ? invoiceTitle : "DropBook_Invoice_" + System.currentTimeMillis();
                                android.print.PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
                                printManager.print(jobName, printAdapter, new android.print.PrintAttributes.Builder().build());
                            }
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
