package expo.modules.temarifileread

import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.IOException

/**
 * Reads a document the system picker just granted us. Every expo JS read API
 * refuses content:// (legacy readAsStringAsync: "Unsupported scheme";
 * copyAsync: a DocumentFile.canRead() probe OEM providers fail). This module
 * does exactly the one thing the SAF contract guarantees:
 * contentResolver.openInputStream in our own process on the just-granted URI.
 *
 * Rules baked in (learned on the A32, Android 13):
 *  - Never probe first: no DocumentFile.canRead()/exists()/getType() — extra
 *    provider round-trips are where OEM providers throw.
 *  - Never copy in another process (that is how Samsung's media layer broke us).
 *  - Enforce the size limit while STREAMING (providers may report SIZE null).
 *  - Pass the URI string through verbatim: the raw:/... percent-encoding is the
 *    document id; normalising it in JS yields a different document.
 */
class TemariFileReadModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TemariFileRead")

    AsyncFunction("readText") { uriString: String, maxBytes: Double, promise: Promise ->
      try {
        promise.resolve(String(readBytes(uriString, maxBytes.toLong()), Charsets.UTF_8))
      } catch (error: Exception) {
        promise.reject(codeOf(error), messageOf(uriString, error), error)
      }
    }

    AsyncFunction("readBase64") { uriString: String, maxBytes: Double, promise: Promise ->
      try {
        promise.resolve(Base64.encodeToString(readBytes(uriString, maxBytes.toLong()), Base64.NO_WRAP))
      } catch (error: Exception) {
        promise.reject(codeOf(error), messageOf(uriString, error), error)
      }
    }
  }

  private fun readBytes(uriString: String, maxBytes: Long): ByteArray {
    val context = appContext?.reactContext
      ?: throw IllegalStateException("no react context")
    val resolver = context.contentResolver
    val uri = Uri.parse(uriString)

    // Best-effort preflight: reject early only when the provider volunteers a
    // size. Query hiccups are swallowed — streaming enforcement below is the
    // authority.
    try {
      resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        val sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (cursor.moveToFirst() && sizeColumn >= 0 && !cursor.isNull(sizeColumn)) {
          val reported = cursor.getLong(sizeColumn)
          if (reported > maxBytes) throw TooLargeException(reported)
        }
      }
    } catch (tooLarge: TemariTooLargeException) {
      throw tooLarge
    } catch (_: Exception) {
      // unknown size — keep going
    }

    // The one read SAF guarantees. Classify, never pre-flight.
    resolver.openInputStream(uri)?.use { input ->
      val output = ByteArrayOutputStream()
      val buffer = ByteArray(64 * 1024)
      var total = 0L
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        total += read
        if (total > maxBytes) throw TemariTooLargeException(total)
        output.write(buffer, 0, read)
      }
      return output.toByteArray()
    } ?: throw IOException("contentResolver returned no stream for $uriString")
  }

  private class TemariTooLargeException(val seen: Long) : Exception("exceeded the size limit at $seen bytes")

  private fun codeOf(error: Exception) = when (error) {
    is TemariTooLargeException -> "ERR_TEMARI_TOO_LARGE"
    is SecurityException -> "ERR_TEMARI_READ_DENIED"
    else -> "ERR_TEMARI_READ_FAILED"
  }

  private fun messageOf(uriString: String, error: Exception) =
    "${error.javaClass.simpleName}: ${error.message} [$uriString]"
}
