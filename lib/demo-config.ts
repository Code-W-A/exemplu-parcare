export const DEMO_PROJECT_ID = "parcari-admin-demo-20261004"
export const DEMO_MESSAGE = "Mediu de test — operație externă simulată"
export const isDemoMode = true

export function assertDemoProject(projectId: string | undefined) {
  if (projectId !== DEMO_PROJECT_ID) throw new Error("Acest panou demo poate folosi numai Firebase " + DEMO_PROJECT_ID)
}
