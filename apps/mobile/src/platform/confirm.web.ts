export async function confirmAction(title: string, message: string, signal?: AbortSignal): Promise<boolean> {
  return !signal?.aborted && window.confirm(`${title}\n\n${message}`);
}
