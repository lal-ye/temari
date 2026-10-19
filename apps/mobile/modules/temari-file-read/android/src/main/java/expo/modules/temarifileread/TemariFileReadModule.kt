package expo.modules.temarifileread

import android.net.Uri
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException

/**
 * Reads a document the system picker just granted us. Every expo-file-system
 * JS API refuses content:// (readAsStringAsync: "Unsupported scheme";
 * copyAsync: DocumentFile.canRead() gate that Samsung's downloads provider
 * fails). contentResolver.openInputStream inside our own process is the one
 * read path the SAF contract guarantees for the grant the picker returned.
 */
class TemariFileReadModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TemariFileRead")

    AsyncFunction("readText") { uri: String, promise: Promise ->
      try {
        promise.resolve(String(readBytes(uri), Charsets.UTF_8))
      } catch (error: Exception) {
        promise.reject("E_READ", "read of $uri failed — $error", error)
      }
    }

    AsyncFunction("readBase64") { uri: String, promise: Promise ->
      try {
        promise.resolve(Base64.encodeToString(readBytes(uri), Base64.NO_WRAP))
      } catch (error: Exception) {
        promise.reject("E_READ", "read of $uri failed — $error", error)
      }
    }
  }

  private fun readBytes(uri: String): ByteArray {
    val stream = appContext?.reactContext?.contentResolver
      ?.openInputStream(Uri.parse(uri))
      ?: throw IOException("contentResolver returned no stream for $uri")
    return stream.use { it.readBytes() }
  }
}
