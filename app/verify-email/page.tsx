"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { FiArrowLeft, FiMail, FiCheck, FiRefreshCw, FiHome, FiX } from "react-icons/fi"
import { Button } from "@heroui/react"
import { sendEmailVerification, onAuthStateChanged, reload, User, applyActionCode } from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth } from "../firebase"
import { motion } from "framer-motion"

// Componente che usa useSearchParams
function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "success" | "error">("pending")
  
  // Verificare il token dell'URL e applicare la verifica
  useEffect(() => {
    const verifyEmail = async () => {
      // Log tutti i parametri dell'URL
      console.log("Verify Email Parameters:", Object.fromEntries(searchParams.entries()));
      
      const oobCode = searchParams.get("oobCode");
      const apiKey = searchParams.get("apiKey");
      const continueUrl = searchParams.get("continueUrl");
      
      console.log("oobCode:", oobCode);
      console.log("apiKey:", apiKey);
      console.log("continueUrl:", continueUrl);
      
      if (!oobCode) {
        setLoading(false);
        return;
      }
      
      let attempts = 0;
      const maxAttempts = 3;
      
      const attemptVerification = async () => {
        attempts++;
        console.log(`Tentativo ${attempts} di verifica email...`);
        
        try {
          // Applica il codice di verifica
          await applyActionCode(auth, oobCode);
          console.log("Verifica email riuscita!");
          setVerificationStatus("success");
          setVerificationMessage("Email verificata con successo! Puoi chiudere questa finestra o tornare alla home.");
          
          // Ricarica le informazioni dell'utente se disponibile
          if (user) {
            await reload(user);
            console.log("User reloaded, emailVerified:", user.emailVerified);
          }
          
          setLoading(false);
          return true; // Verifica riuscita
        } catch (error) {
          console.error(`Errore durante il tentativo ${attempts} di verifica:`, error);
          
          // Controlla comunque se l'utente è verificato 
          let userVerified = false;
          
          if (user) {
            try {
              await reload(user);
              console.log("Stato utente dopo reload:", user.emailVerified);
              userVerified = user.emailVerified;
              
              if (userVerified) {
                console.log("L'utente risulta verificato nonostante l'errore!");
                setVerificationStatus("success");
                setVerificationMessage("Email verificata con successo! Puoi chiudere questa finestra o tornare alla home.");
                setLoading(false);
                return true; // Utente verificato
              }
            } catch (reloadError) {
              console.error("Errore durante il reload dell'utente:", reloadError);
            }
          }
          
          // Se abbiamo altri tentativi disponibili e l'errore è di tipo invalid-action-code
          // potrebbe essere un problema temporaneo, ritentiamo
          if (
            attempts < maxAttempts && 
            error instanceof FirebaseError && 
            error.code === 'auth/invalid-action-code'
          ) {
            console.log(`Riprovo tra 1.5 secondi (tentativo ${attempts}/${maxAttempts})...`);
            return false; // Riprova
          }
          
          // Se abbiamo esaurito i tentativi o l'errore è diverso, mostriamo l'errore
          setVerificationStatus("error");
          
          if (error instanceof FirebaseError) {
            if (error.code === 'auth/invalid-action-code') {
              setVerificationMessage("Questo link di verifica non è più valido o è già stato utilizzato.");
            } else {
              setVerificationMessage(`Errore: ${error.message}`);
            }
          } else {
            setVerificationMessage("Si è verificato un errore durante la verifica dell'email.");
          }
          
          setLoading(false);
          return true; // Non riprova più
        }
      };
      
      // Funzione per gestire i tentativi con ritardo
      const runVerificationWithRetries = async () => {
        const success = await attemptVerification();
        if (!success && attempts < maxAttempts) {
          // Attende 1.5 secondi prima di riprovare
          setTimeout(runVerificationWithRetries, 1500);
        }
      };
      
      runVerificationWithRetries();
    };
    
    verifyEmail();
  }, [searchParams, user]);
  
  // Verificare lo stato dell'utente
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Se c'è un oobCode (codice di verifica) nell'URL, procedi anche senza utente loggato
      const oobCode = searchParams.get("oobCode");
      
      if (!currentUser) {
        if (oobCode) {
          // Se c'è un codice di verifica ma non un utente loggato, imposta solo loading a false
          // per permettere alla verifica di procedere
          setLoading(false);
        } else {
          // Se non c'è né codice di verifica né utente loggato, reindirizza alla pagina di accesso
          router.push('/access');
        }
        return;
      }
      
      setUser(currentUser);
      
      // Se non stiamo verificando tramite token e l'utente ha già verificato l'email, reindirizza alla home
      if (currentUser.emailVerified && verificationStatus === "pending" && !searchParams.get("oobCode")) {
        setVerificationStatus("success")
        setVerificationMessage("Email verificata con successo! Reindirizzamento in corso...");
        setTimeout(() => {
          router.push('/');
        }, 2000);
      }
      
      if (!searchParams.get("oobCode")) {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, searchParams, verificationStatus]);
  
  // Countdown per abilitare il pulsante di reinvio
  useEffect(() => {
    if (loading || canResend) return;
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [loading, canResend]);
  
  // Controlla periodicamente se l'utente ha verificato l'email
  useEffect(() => {
    if (!user || user.emailVerified || verificationStatus !== "pending" || searchParams.get("oobCode")) return;
    
    const checkVerification = setInterval(async () => {
      try {
        // Ricarica le informazioni dell'utente per controllare lo stato di verifica
        if (user) {
          await reload(user);
          if (user.emailVerified) {
            clearInterval(checkVerification);
            setVerificationStatus("success")
            setVerificationMessage("Email verificata con successo! Reindirizzamento in corso...");
            setTimeout(() => {
              router.push('/');
            }, 2000);
          }
        }
      } catch (error) {
        console.error("Errore durante il controllo della verifica:", error);
      }
    }, 5000); // Controlla ogni 5 secondi
    
    return () => clearInterval(checkVerification);
  }, [user, router, verificationStatus, searchParams]);
  
  // Gestione del reinvio dell'email di verifica
  const handleResendVerification = async () => {
    if (!user || resendLoading) return;
    
    setResendLoading(true);
    
    try {
      // Configurazione URL diretto alla pagina di verifica email
      // invece di passare per auth-action
      const actionCodeSettings = {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: true
      };
      
      console.log("Invio email di verifica con URL:", actionCodeSettings.url);
      
      // Invia email di verifica con URL personalizzato
      await sendEmailVerification(user, actionCodeSettings);
      
      setVerificationMessage("Email di verifica inviata nuovamente! Controlla la tua casella di posta.");
      setCanResend(false);
      setCountdown(60);
    } catch (error) {
      if (error instanceof FirebaseError) {
        setVerificationMessage(`Errore: ${error.message}`);
      } else {
        setVerificationMessage("Si è verificato un errore durante l'invio dell'email di verifica.");
      }
    } finally {
      setResendLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin h-12 w-12 border-4 border-zinc-300 border-t-amber-500 rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-300">Caricamento...</p>
        </div>
      </div>
    );
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800 flex flex-col items-center justify-center p-4">
      {/* Logo/Branding */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-8">
        <Link href="/" className="flex items-center text-zinc-200 hover:opacity-80 transition-opacity">
          <FiArrowLeft className="mr-2 h-5 w-5" />
          <span className="font-serif text-lg">GIORNALE</span>
        </Link>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-amber-500/10 to-orange-600/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 rounded-full filter blur-3xl"></div>
      </div>
      
      {/* Main Content */}
      <div className="w-full max-w-md z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-200">
            Verifica Email
          </h1>
          <p className="mt-3 text-zinc-300 text-sm sm:text-base">
            {verificationStatus === "success" 
              ? "Email verificata con successo!" 
              : verificationStatus === "error"
                ? "Si è verificato un problema"
                : `Verifica la tua email: ${user?.email}`}
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-md w-full mx-auto p-8 backdrop-blur-xl bg-zinc-800/20 border border-zinc-700 rounded-2xl shadow-2xl"
        >
          {verificationMessage && (
            <div className={`mb-6 p-4 ${
              verificationStatus === "success" 
                ? "bg-green-500/10 border-green-500/30 text-green-500" 
                : verificationStatus === "error"
                  ? "bg-red-500/10 border-red-500/30 text-red-500"
                  : "bg-blue-500/10 border-blue-500/30 text-blue-500"
            } backdrop-blur-sm border rounded-xl text-sm animate-fade-in`}>
              <div className="flex items-center">
                {verificationStatus === "success" ? (
                  <FiCheck className="mr-2 h-5 w-5 flex-shrink-0" />
                ) : verificationStatus === "error" ? (
                  <FiX className="mr-2 h-5 w-5 flex-shrink-0" />
                ) : (
                  <FiMail className="mr-2 h-5 w-5 flex-shrink-0" />
                )}
                <p>{verificationMessage}</p>
              </div>
            </div>
          )}
          
          {verificationStatus === "pending" && (
            <div className="space-y-6">
              <div className="p-6 bg-zinc-800/10 backdrop-blur-sm border border-zinc-700 rounded-xl text-center">
                <FiMail className="mx-auto h-12 w-12 text-amber-500 mb-4" />
                <h2 className="text-xl font-bold text-zinc-200 mb-2">Controlla la tua casella email</h2>
                <p className="text-zinc-300 text-sm mb-4">
                  Abbiamo inviato un link di verifica alla tua email. Clicca sul link per verificare il tuo account.
                </p>
                <div className="flex flex-col gap-4 mt-6">
                  <Button
                    variant="solid"
                    className={`w-full py-4 bg-gradient-to-r rounded-xl ${canResend ? "from-amber-500 to-orange-600" : "from-zinc-600 to-zinc-700"} text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-90 text-base font-medium tracking-wide ${
                      !canResend || resendLoading ? "opacity-70 cursor-not-allowed" : "hover:shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02]"
                    }`}
                    onClick={handleResendVerification}
                    disabled={!canResend || resendLoading}
                  >
                    <FiRefreshCw className={`mr-2 h-5 w-5 ${resendLoading ? "animate-spin" : ""}`} />
                    {resendLoading 
                      ? "Invio in corso..." 
                      : canResend 
                        ? "Invia nuovamente" 
                        : `Riprova tra ${countdown} secondi`
                    }
                  </Button>
                  
                  <Link href="/" className="w-full">
                    <Button
                      variant="ghost"
                      className="w-full py-4 bg-zinc-800/30 backdrop-blur-sm text-zinc-200 border border-zinc-700 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:bg-zinc-700/60 hover:scale-[1.02] hover:border-zinc-700/60"
                    >
                      <FiHome className="mr-2 h-5 w-5" />
                      Torna alla home
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
          
          {verificationStatus === "success" && (
            <div className="p-6 bg-green-500/10 backdrop-blur-sm border border-green-500/30 rounded-xl text-center">
              <FiCheck className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Email verificata con successo!</h2>
              <p className="text-zinc-300 text-sm mb-4">
                {user 
                  ? "La tua email è stata verificata correttamente. Ora puoi utilizzare tutte le funzionalità del sito."
                  : "La tua email è stata verificata correttamente. Effettua l'accesso per utilizzare tutte le funzionalità del sito."}
              </p>
              <div className="flex flex-col gap-4">
                <Link href="/" className="w-full">
                  <Button
                    variant="solid"
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-90 hover:shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02] text-base font-medium tracking-wide"
                  >
                    <FiHome className="mr-2 h-5 w-5" />
                    Vai alla home
                  </Button>
                </Link>
                
                {!user && (
                  <Link href="/access" className="w-full">
                    <Button
                      variant="ghost"
                      className="w-full py-4 bg-zinc-800/30 backdrop-blur-sm text-zinc-200 border border-zinc-700 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:bg-zinc-700/60 hover:scale-[1.02] hover:border-zinc-700/60"
                    >
                      <FiMail className="mr-2 h-5 w-5" />
                      Accedi
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
          
          {verificationStatus === "error" && (
            <div className="p-6 bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl text-center">
              <FiX className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Si è verificato un problema</h2>
              <p className="text-zinc-300 text-sm mb-4">
                Il link di verifica non è valido o è scaduto. Riprova con un nuovo link di verifica.
              </p>
              <div className="flex flex-col gap-4 mt-6">
                <Button
                  variant="solid"
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-90 hover:shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02] text-base font-medium tracking-wide"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                >
                  <FiRefreshCw className={`mr-2 h-5 w-5 ${resendLoading ? "animate-spin" : ""}`} />
                  {resendLoading ? "Invio in corso..." : "Invia un nuovo link"}
                </Button>
                
                <Link href="/" className="w-full">
                  <Button
                    variant="ghost"
                    className="w-full py-4 bg-zinc-800/30 backdrop-blur-sm text-zinc-200 border border-zinc-700 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:bg-zinc-700/60 hover:scale-[1.02] hover:border-zinc-700/60"
                  >
                    <FiHome className="mr-2 h-5 w-5" />
                    Torna alla home
                  </Button>
                </Link>
              </div>
            </div>
          )}
          
          {verificationStatus === "pending" && (
            <div className="mt-6 text-center text-xs text-zinc-500">
              <p>Non hai ricevuto l&apos;email? Controlla nella cartella spam o richiedi un nuovo invio quando il countdown sarà terminato.</p>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}

// Loading component to show while the form is loading
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

// Main component with Suspense boundary
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <VerifyEmailContent />
    </Suspense>
  );
} 