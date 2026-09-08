/**
 * "Open Provider settings" from anywhere.
 *
 * The settings dialog is owned by `App`, but the places that need to send a
 * learner there — an offline banner explaining that the Provider rejected
 * the key — live several components deep in each hub. Threading a callback
 * through NotesManager, QuizzesManager, ExamsManager and the explainer for
 * one button is the wrong shape; a tiny external store in the style of
 * `confirm.tsx` and `toast.tsx` lets any component *request* the dialog and
 * `App` answer.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

/** Ask the app to open the Provider settings dialog. */
export function requestProviderSettings() {
  for (const l of listeners) l();
}

/** `App` subscribes once; the returned function unsubscribes. */
export function onProviderSettingsRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
