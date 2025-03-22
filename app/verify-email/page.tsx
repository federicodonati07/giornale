"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FiArrowLeft, FiMail, FiCheck, FiRefreshCw, FiHome } from "react-icons/fi"
import { Button } from "@heroui/react"
import { sendEmailVerification, onAuthStateChanged, reload, User } from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth } from "../firebase"
import { motion } from "framer-motion"

export default function VerifyEmailPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)
  
  // Verificare lo stato dell'utente
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        // Se non c'è un utente loggato, reindirizza alla pagina di accesso
        router.push('/access');
        return;
      }
      
      setUser(currentUser);
      setLoading(false);
      
      // Se l'utente ha già verificato l'email, reindirizza alla home
      if (currentUser.emailVerified) {
        setVerificationMessage("Email verificata con successo! Reindirizzamento in corso...");
        setTimeout(() => {
          router.push('/');
        }, 2000);
      }
    });

    return () => unsubscribe();
  }, [router]);
  
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
    if (!user || user.emailVerified) return;
    
    const checkVerification = setInterval(async () => {
      try {
        // Ricarica le informazioni dell'utente per controllare lo stato di verifica
        if (user) {
          await reload(user);
          if (user.emailVerified) {
            clearInterval(checkVerification);
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
  }, [user, router]);
  
  // Gestione del reinvio dell'email di verifica
  const handleResendVerification = async () => {
    if (!user || resendLoading) return;
    
    setResendLoading(true);
    
    try {
      await sendEmailVerification(user);
      setVerificationMessage("Email di verifica inviata nuovamente!");
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
            Abbiamo inviato un&apos;email di verifica a {user?.email}
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-md w-full mx-auto p-8 backdrop-blur-xl bg-zinc-800/20 border border-zinc-700 rounded-2xl shadow-2xl"
        >
          {verificationMessage && (
            <div className={`mb-6 p-4 ${verificationMessage.includes("successo") ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-blue-500/10 border-blue-500/30 text-blue-500"} backdrop-blur-sm border rounded-xl text-sm animate-fade-in`}>
              <div className="flex items-center">
                {verificationMessage.includes("successo") ? (
                  <FiCheck className="mr-2 h-5 w-5 flex-shrink-0" />
                ) : (
                  <FiMail className="mr-2 h-5 w-5 flex-shrink-0" />
                )}
                <p>{verificationMessage}</p>
              </div>
            </div>
          )}
          
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
          
          <div className="mt-6 text-center text-xs text-zinc-500">
            <p>Non hai ricevuto l&apos;email? Controlla nella cartella spam o richiedi un nuovo invio quando il countdown sarà terminato.</p>
          </div>
        </motion.div>
      </div>
    </main>
  );
} 