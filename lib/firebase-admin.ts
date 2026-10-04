import { assertDemoProject } from "./demo-config"
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

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

function getFirebaseAdminApp(): App {
  assertDemoProject(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  const existing = getApps()[0]
  if (existing) {
    assertDemoProject(existing.options.projectId)
    return existing
  }

  const serviceAccount = readServiceAccountFromEnv()
  if (serviceAccount?.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
    assertDemoProject(serviceAccount.projectId)
    return initializeApp({
      projectId: serviceAccount.projectId,
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
    })
  }

  if (process.env.DEMO_LOCAL_ADC === "true" && !process.env.VERCEL) {
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, credential: applicationDefault() })
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY este obligatorie pentru proiectul demo; nu folosim credențiale implicite.")
}

const firebaseAdminApp = getFirebaseAdminApp()

export const adminAuth = getAuth(firebaseAdminApp)
export const adminDb = getFirestore(firebaseAdminApp)
