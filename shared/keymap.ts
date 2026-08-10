// web-only: 按浏览器所在操作系统决定修饰键（Mac 浏览器用 ⌘）
export function isMacOS(): boolean {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent)
}

export function getKeymap() {
  const mod = isMacOS() ? "m" : "c"
  return {
    "chat-input:submit": `<${mod}-enter>`,
    "chat-input:upload-file": `<${mod}-u>`,
    "chat-input:focus": `<${mod}-k>`,
    "chat-input:paste-last-message": `<${mod}-V>`,
    "chat-message:copy-last": `<${mod}-C>`,
    "chat:delete": `<${mod}-s-backspace>`,
    "global:new-chat": `<${mod}-O>`,
    "global:toggle-sidebar": `<${mod}-S>`,
    "global:close-layer": "<escape>",
    "global:toggle-keymap-modal": `<${mod}-/>`,
  }
}
