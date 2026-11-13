package com.smoore.johnsgambit

import android.annotation.SuppressLint
import android.content.ContentValues
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import java.io.InputStream

/**
 * John's Gambit runs as an offline web game bundled in the APK's assets.
 * Everything (puzzles, openings, Stockfish) is local; the app needs no internet.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Serves assets/www at https://appassets.androidplatform.net/assets/www/
        // so storage, workers and WebAssembly behave like a normal website.
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", AssetHandler())
            .build()

        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.databaseEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.setBackgroundColor(0xFF08081A.toInt())
        web.addJavascriptInterface(Bridge(), "Android")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = loader.shouldInterceptRequest(request.url)
        }
        setContentView(web)
        web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")

        // Back button goes back inside the game first.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("window.JG && JG.back ? JG.back() : false") { r ->
                    if (r != "true") finish()
                }
            }
        })
    }

    /** Asset handler that also sets the right type for .wasm (needed by Stockfish). */
    private inner class AssetHandler : WebViewAssetLoader.PathHandler {
        override fun handle(path: String): WebResourceResponse? {
            return try {
                val stream: InputStream = assets.open(path)
                WebResourceResponse(mimeFor(path), null, stream)
            } catch (e: Exception) {
                null
            }
        }
    }

    private fun mimeFor(path: String): String = when {
        path.endsWith(".html") -> "text/html"
        path.endsWith(".js") -> "text/javascript"
        path.endsWith(".css") -> "text/css"
        path.endsWith(".json") -> "application/json"
        path.endsWith(".wasm") -> "application/wasm"
        path.endsWith(".svg") -> "image/svg+xml"
        path.endsWith(".png") -> "image/png"
        path.endsWith(".woff2") -> "font/woff2"
        path.endsWith(".mp3") -> "audio/mpeg"
        path.endsWith(".wav") -> "audio/wav"
        else -> "application/octet-stream"
    }

    /** Small bridge so the game can save a progress backup to Downloads. */
    inner class Bridge {
        @JavascriptInterface
        fun saveBackup(json: String): Boolean {
            return try {
                val name = "johns-gambit-backup.json"
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, name)
                        put(MediaStore.Downloads.MIME_TYPE, "application/json")
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    }
                    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: return false
                    contentResolver.openOutputStream(uri)?.use { it.write(json.toByteArray()) }
                } else {
                    val dir = getExternalFilesDir(null) ?: return false
                    java.io.File(dir, name).writeText(json)
                }
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Backup saved to Downloads", Toast.LENGTH_LONG).show()
                }
                true
            } catch (e: Exception) {
                false
            }
        }
    }
}
