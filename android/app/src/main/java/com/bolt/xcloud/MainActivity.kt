package com.bolt.xcloud

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AlertDialog

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val logBuffer = StringBuilder()
    private var hasReloadedOnChunkError = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        val logsButton = findViewById<android.widget.Button>(R.id.logs_button)
        val resetButton = findViewById<android.widget.Button>(R.id.reset_button)

        WebView.setWebContentsDebuggingEnabled(true)

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_NO_CACHE

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.addJavascriptInterface(JsBridge(), "BoltBridge")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                appendLog("console", "${consoleMessage.message()} (${consoleMessage.lineNumber()})")
                if (!hasReloadedOnChunkError && consoleMessage.message().contains("ChunkLoadError", true)) {
                    handleChunkLoadError("console", consoleMessage.message())
                }
                return super.onConsoleMessage(consoleMessage)
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    appendLog("web", "${error.errorCode}: ${error.description}")
                }
                super.onReceivedError(view, request, error)
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                appendLog("http", "${errorResponse.statusCode} ${errorResponse.reasonPhrase}")
                super.onReceivedHttpError(view, request, errorResponse)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectDiagnostics()
                injectScript()
            }
        }

        logsButton.setOnClickListener {
            showLogs()
        }

        resetButton.setOnClickListener {
            appendLog("action", "Reset WebView")
            hasReloadedOnChunkError = false
            webView.clearCache(true)
            webView.clearHistory()
            webView.loadUrl("https://www.xbox.com/en-US/play")
        }

        webView.loadUrl("https://www.xbox.com/en-US/play")
    }

    private fun injectDiagnostics() {
        val js = """
            (function() {
                if (window.__BOLT_DIAG__) return;
                window.__BOLT_DIAG__ = true;
                window.addEventListener('error', function(e) {
                    try {
                        var msg = e && e.message ? e.message : 'Unknown error';
                        BoltBridge.log('js', msg);
                        if (String(msg).indexOf('ChunkLoadError') !== -1) {
                            BoltBridge.chunkError(String(msg));
                        }
                    } catch(_) {}
                });
                window.addEventListener('unhandledrejection', function(e) {
                    try {
                        var reason = String(e.reason || 'Unknown rejection');
                        BoltBridge.log('promise', reason);
                        if (reason.indexOf('ChunkLoadError') !== -1) {
                            BoltBridge.chunkError(reason);
                        }
                    } catch(_) {}
                });
                const orgLog = console.log;
                console.log = function() {
                    try { BoltBridge.log('log', Array.from(arguments).join(' ')); } catch(_) {}
                    return orgLog.apply(console, arguments);
                };
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun handleChunkLoadError(source: String, message: String) {
        if (hasReloadedOnChunkError) return
        hasReloadedOnChunkError = true
        appendLog("auto", "Reloading after ChunkLoadError ($source)")
        webView.clearCache(true)
        val js = """
            (async function() {
                try {
                    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(regs.map(r => r.unregister()));
                    }
                    if (window.caches && caches.keys) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(k => caches.delete(k)));
                    }
                } catch (e) {}
                location.reload();
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun injectScript() {
        val script = assets.open("bolt-xcloud.user.js").bufferedReader().use { it.readText() }
        val cleaned = script.replace(Regex("(?s)// ==UserScript==.*?// ==/UserScript=="), "")
        val wrapped = "(function(){try{if(window.__BOLT_XCLOUD_INJECTED__){return;}" +
            "window.__BOLT_XCLOUD_INJECTED__=true;" + cleaned +
            "}catch(e){try{BoltBridge.log('inject', e && e.stack ? e.stack : String(e));}catch(_){}}})();"

        webView.evaluateJavascript(wrapped, null)
    }

    private fun appendLog(tag: String, message: String) {
        if (logBuffer.length > 6000) {
            logBuffer.delete(0, 2000)
        }
        logBuffer.append("[").append(tag).append("] ").append(message).append("\n")
    }

    private fun showLogs() {
        val logs = logBuffer.toString().ifBlank { "No logs yet." }
        AlertDialog.Builder(this)
            .setTitle("Bolt Xcloud Logs")
            .setMessage(logs)
            .setPositiveButton("Close", null)
            .show()
    }

    inner class JsBridge {
        @JavascriptInterface
        fun log(tag: String, message: String) {
            appendLog(tag, message)
        }

        @JavascriptInterface
        fun chunkError(message: String) {
            handleChunkLoadError("js", message)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
