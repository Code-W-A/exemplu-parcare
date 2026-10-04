export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { assertDemoProject } = await import("./lib/demo-config")
  assertDemoProject(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  const original = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const value = input instanceof Request ? input.url : String(input)
    const url = new URL(value)
    const allowed = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".googleapis.com") || url.hostname.endsWith(".google.com")
    if (!allowed) throw new Error("Demo: apel extern blocat către " + url.hostname)
    return original(input, { ...init, redirect: "error" })
  }
}
