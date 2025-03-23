"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export default function VerificaEmailRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Ottieni tutti i parametri originali
    const oobCode = searchParams.get("oobCode")
    const apiKey = searchParams.get("apiKey")
    const continueUrl = searchParams.get("continueUrl")
    const lang = searchParams.get("lang")
    const mode = searchParams.get("mode")
    
    // Crea una nuova query string
    const queryParams = new URLSearchParams()
    
    // Aggiungi il nostro parametro mode personalizzato
    queryParams.set("mode", "verify")
    
    // Mantieni tutti i parametri originali
    if (oobCode) queryParams.set("oobCode", oobCode)
    if (apiKey) queryParams.set("apiKey", apiKey)
    if (continueUrl) queryParams.set("continueUrl", continueUrl)
    if (lang) queryParams.set("lang", lang)
    if (mode) queryParams.set("firebaseMode", mode) // Rinomina per evitare conflitti
    
    // Reindirizza all'handler centralizzato
    router.replace(`/auth-action?${queryParams.toString()}`)
  }, [router, searchParams])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="animate-spin h-12 w-12 border-4 border-zinc-300 border-t-amber-500 rounded-full mx-auto mb-4"></div>
        <p className="text-zinc-300">Reindirizzamento in corso...</p>
      </div>
    </div>
  )
} 