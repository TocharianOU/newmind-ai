export * from "./env"
export * from "./init"
export * from "./oap"
export * from "./host"
export * from "./config"
export * from "./llm"
export * from "./project"

export function listenIPC(event: string, listener: (...args: any[]) => void): () => void {
  void event
  void listener
  return () => {}
}

export async function invokeIPC(cmd: string, ...args: any[]) {
  void args
  console.warn(`[web] invokeIPC("${cmd}") skipped`)
  return undefined
}