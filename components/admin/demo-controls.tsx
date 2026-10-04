"use client"
import { useEffect, useState } from 'react'
import { isDemoPersistent, resetDemo, subscribeDemo } from '@/lib/demo-data'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog'

export function DemoControls() {
  const [persistent, setPersistent] = useState(true)
  useEffect(() => {
    const refresh = () => setPersistent(isDemoPersistent())
    refresh()
    return subscribeDemo(refresh)
  }, [])
  return <div className="bg-amber-100 px-4 py-2 text-sm text-amber-950 flex flex-wrap items-center justify-between gap-2">
    <div role="status">Mediu de test · Date fictive · Toate integrările sunt simulate.
      {!persistent && <p className="font-semibold">Stocarea browserului nu este disponibilă. Modificările se pierd la reîncărcare.</p>}
    </div>
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm">Resetează demo</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Resetezi datele demo?</AlertDialogTitle><AlertDialogDescription>Modificările din acest browser vor fi înlocuite cu 100 de rezervări fictive și configurațiile inițiale, raportate la ziua de azi. Resetarea se aplică și taburilor deschise ale acestui demo.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Renunță</AlertDialogCancel><AlertDialogAction onClick={() => { resetDemo(); window.location.assign('/admin/dashboard') }}>Resetează demo</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
}
