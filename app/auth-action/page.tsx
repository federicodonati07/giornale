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
      // Log completo di tutti i parametri ricevuti per debug
      console.log("Auth Action Parameters:", Object.fromEntries(searchParams.entries()));
      
      // Ottieni il parametro mode dall'URL
      const mode = searchParams.get("mode")
      // Ottieni il parametro oobCode dall'URL (inviato da Firebase)
      const oobCode = searchParams.get("oobCode")
      
      if (!oobCode) {
        console.error("Nessun codice di azione trovato nell'URL")
        router.push("/") // Reindirizza alla home se non c'è un codice valido
        return
      }
      
      // Prepara la query string passando TUTTI i parametri originali
      // Questo garantisce che tutti i parametri necessari vengano trasferiti
      const queryParams = new URLSearchParams()
      
      // Copia tutti i parametri originali dall'URL
      searchParams.forEach((value, key) => {
        queryParams.set(key, value)
      })
      
      console.log("Query params finali:", queryParams.toString());
      
      // Firebase aggiunge automaticamente mode nei suoi link
      // Usiamo il mode per determinare la pagina di destinazione
      
      if (mode === "verify" || mode === "verifyEmail") {
        // Reindirizza alla pagina di verifica email
        router.push(`/verify-email?${queryParams.toString()}`)
      } else if (mode === "reset" || mode === "resetPassword") {
        // Reindirizza alla pagina di reset password
        router.push(`/reset-password-confirm?${queryParams.toString()}`)
      } else {
        // Se non c'è un parametro mode esplicito, proviamo a determinare l'azione dal contesto
        console.log("Mode non specificato, provo a determinare l'azione dal contesto");
        
        // Se c'è continuePath, potrebbe contenere indizi sull'azione da eseguire
        const continueUrl = searchParams.get("continueUrl") || "";
        if (continueUrl.includes("verify")) {
          console.log("Rilevata azione di verifica email dal continueUrl");
          router.push(`/verify-email?${queryParams.toString()}`)
        } else if (continueUrl.includes("reset")) {
          console.log("Rilevata azione di reset password dal continueUrl");
          router.push(`/reset-password-confirm?${queryParams.toString()}`)
        } else {
          console.error("Impossibile determinare il tipo di azione, reindirizzo alla home");
          router.push("/") // Reindirizza alla home se il mode non è valido
        }
      }
    }
    
    // Esegui il routing immediatamente
    handleRouting()
    
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