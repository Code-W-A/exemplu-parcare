"use client"
import { useEffect, useState } from 'react'
import { subscribeDemo } from '@/lib/demo-data'
export function useDemoRevision() {
  const [revision, setRevision] = useState(0)
  useEffect(() => subscribeDemo(() => setRevision(v => v + 1)), [])
  return revision
}
