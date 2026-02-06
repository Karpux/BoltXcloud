package com.bolt.xcloud

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString = settings.userAgentString + " BoltXcloud"

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectScript()
            }
        }

        webView.loadUrl("https://www.xbox.com/en-US/play")
    }

    private fun injectScript() {
        val script = assets.open("bolt-xcloud.user.js").bufferedReader().use { it.readText() }
        val cleaned = script.replace(Regex("(?s)// ==UserScript==.*?// ==/UserScript=="), "")
        val wrapped = "(function(){if(window.__BOLT_XCLOUD_INJECTED__){return;}" +
            "window.__BOLT_XCLOUD_INJECTED__=true;" + cleaned + "})();"

        webView.evaluateJavascript(wrapped, null)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
