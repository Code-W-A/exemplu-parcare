import { assertDemoProject } from "./demo-config"
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import type { Auth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"
import type { Firestore } from "firebase-admin/firestore"

type ServiceAccountShape = {
  projectId?: string
  clientEmail?: string
  privateKey?: string
}

function readServiceAccountFromEnv(): ServiceAccountShape | null {
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as {
      project_id?: string
      projectId?: string
      client_email?: string
      clientEmail?: string
      private_key?: string
      privateKey?: string
    }

    return {
      projectId: parsed.projectId || parsed.project_id,
      clientEmail: parsed.clientEmail || parsed.client_email,
      privateKey: (parsed.privateKey || parsed.private_key || "").replace(/\\n/g, "\n"),
    }
  } catch (error) {
    console.error("[firebase-admin] Invalid service account JSON in env.", error)
    return null
  }
}

let firebaseAdminApp: App | undefined

function getFirebaseAdminApp(): App {
  if (firebaseAdminApp) return firebaseAdminApp

  assertDemoProject(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  const existing = getApps()[0]
  if (existing) {
    assertDemoProject(existing.options.projectId)
    firebaseAdminApp = existing
    return firebaseAdminApp
  }

  const serviceAccount = readServiceAccountFromEnv()
  if (serviceAccount?.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
    assertDemoProject(serviceAccount.projectId)
    firebaseAdminApp = initializeApp({
      projectId: serviceAccount.projectId,
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
    })
    return firebaseAdminApp
  }

  if (process.env.DEMO_LOCAL_ADC === "true" && !process.env.VERCEL) {
    firebaseAdminApp = initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, credential: applicationDefault() })
    return firebaseAdminApp
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY este obligatorie pentru proiectul demo; nu folosim credențiale implicite.")
}

function lazyFirebaseService<T extends object>(createService: () => T): T {
  const target = Object.create(null) as T
  return new Proxy(target, {
    get(_target, property) {
      const service = createService()
      const value = Reflect.get(service, property, service)
      return typeof value === "function" ? value.bind(service) : value
    },
    set(_target, property, value) {
      return Reflect.set(createService(), property, value)
    },
  })
}

// Importing API route modules during `next build` must not initialize Admin SDK
// or inspect credentials. Validate the project and initialize only on a real request.
export const adminAuth = lazyFirebaseService<Auth>(() => getAuth(getFirebaseAdminApp()))
export const adminDb = lazyFirebaseService<Firestore>(() => getFirestore(getFirebaseAdminApp()))
