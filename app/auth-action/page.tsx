"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// Componente di loading
function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="animate-spin h-12 w-12 border-4 border-zinc-300 border-t-amber-500 rounded-full mx-auto mb-4"></div>
        <p className="text-zinc-300">Caricamento...</p>
      </div>
    </div>
  );
}

// Componente che gestisce il routing in base al parametro mode
function AuthActionRouter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const handleRouting = () => {
      // Ottieni il parametro mode dall'URL
      const mode = searchParams.get("mode")
      // Ottieni il parametro oobCode dall'URL (inviato da Firebase)
      const oobCode = searchParams.get("oobCode")
      
      if (!oobCode) {
        console.error("Nessun codice di azione trovato nell'URL")
        router.push("/") // Reindirizza alla home se non c'è un codice valido
        return
      }
      
      // Prepara la query string da passare alle pagine di destinazione
      const queryParams = new URLSearchParams()
      queryParams.set("oobCode", oobCode)
      
      // Firebase aggiunge automaticamente mode nei suoi link
      // ma usiamo il nostro parametro mode personalizzato per il routing
      
      if (mode === "verify") {
        // Reindirizza alla pagina di verifica email
        router.push(`/verify-email?${queryParams.toString()}`)
      } else if (mode === "reset") {
        // Reindirizza alla pagina di reset password
        router.push(`/reset-password-confirm?${queryParams.toString()}`)
      } else {
        // Se il nostro parametro mode non è specificato, proviamo a usare il mode di Firebase
        const firebaseMode = searchParams.get("mode")
        
        if (firebaseMode === "verifyEmail") {
          router.push(`/verify-email?${queryParams.toString()}`)
        } else if (firebaseMode === "resetPassword") {
          router.push(`/reset-password-confirm?${queryParams.toString()}`)
        } else {
          console.error("Parametro mode non valido o mancante")
          router.push("/") // Reindirizza alla home se il mode non è valido
        }
      }
    }
    
    // Esegui il routing con un piccolo ritardo per assicurarsi che tutti i parametri siano caricati
    const timeout = setTimeout(() => {
      handleRouting()
    }, 100)
    
    return () => clearTimeout(timeout)
  }, [router, searchParams])
  
  return <LoadingState />
}

// Componente principale
export default function AuthActionPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuthActionRouter />
    </Suspense>
  );
} 