export async function initFetch() {
  return globalThis.fetch
}

// Export the original fetch for special cases where absolute URLs are needed.
export const nativeFetch = window.fetch;

export async function startReceiveDownloadDependencyLog() {
  return
}

export async function onReceiveDownloadDependencyLog(callback: (log: string) => void): Promise<() => void> {
  void callback
  return () => {}
}