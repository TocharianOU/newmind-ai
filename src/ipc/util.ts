export function copyImage(src: string) {
  return fetch(src)
    .then(res => res.blob())
    .then(blob => navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]))
}

export function convertLocalFileSrc(src: string) {
  return src
}

export function openUrl(url: string) {
  window.open(url, "_blank")
}

export async function readLocalLogo(logoPath: string): Promise<string | null> {
  void logoPath
  return null
}