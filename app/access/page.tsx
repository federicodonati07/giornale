"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FiArrowLeft, FiMail, FiLock, FiGithub, FiUser, FiCheck, FiX, FiEye, FiEyeOff } from "react-icons/fi"
import { FcGoogle } from "react-icons/fc"
import { Button } from "@heroui/react"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, onAuthStateChanged } from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth } from "../firebase"
import { motion, useScroll, useTransform } from "framer-motion"

type NotificationType = "success" | "error" | "info" | null;

interface Notification {
  type: NotificationType;
  message: string;
}

// Funzione per interpretare gli errori di Firebase
const getFirebaseErrorMessage = (error: FirebaseError): string => {
  const errorCode = error.code;
  
  // Mappa dei codici di errore di Firebase in messaggi user-friendly in italiano
  const errorMessages: Record<string, string> = {
    // Errori di autenticazione
    'auth/email-already-in-use': 'Questa email è già in uso. Prova ad accedere invece di registrarti.',
    'auth/invalid-email': 'L\'indirizzo email non è valido.',
    'auth/user-disabled': 'Questo account è stato disabilitato. Contatta l\'assistenza.',
    'auth/user-not-found': 'Nessun account trovato con questa email.',
    'auth/wrong-password': 'Password errata. Riprova o usa "Password dimenticata".',
    'auth/weak-password': 'La password è troppo debole. Usa almeno 6 caratteri.',
    'auth/operation-not-allowed': 'Questo tipo di accesso non è consentito.',
    'auth/account-exists-with-different-credential': 'Un account esiste già con la stessa email ma con credenziali diverse.',
    'auth/invalid-credential': 'Le credenziali fornite non sono valide.',
    'auth/invalid-verification-code': 'Il codice di verifica non è valido.',
    'auth/invalid-verification-id': 'L\'ID di verifica non è valido.',
    'auth/requires-recent-login': 'Questa operazione richiede un accesso recente. Accedi di nuovo.',
    'auth/too-many-requests': 'Troppi tentativi falliti. Riprova più tardi.',
    'auth/popup-closed-by-user': 'Il popup di accesso è stato chiuso prima di completare l\'operazione.',
    'auth/cancelled-popup-request': 'La richiesta di popup è stata annullata.',
    'auth/popup-blocked': 'Il popup è stato bloccato dal browser. Abilita i popup per questo sito.',
    'auth/network-request-failed': 'Errore di rete. Controlla la tua connessione internet.',
    'auth/timeout': 'Timeout della richiesta. Riprova più tardi.',
  };
  
  // Restituisci il messaggio personalizzato o un messaggio generico se il codice non è mappato
  return errorMessages[errorCode] || `Si è verificato un errore: ${error.message}`;
};

export default function AccessPage() {
  const router = useRouter();
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [isRegistering, setIsRegistering] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [notification, setNotification] = useState<Notification | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Refs per gli elementi con effetti parallax
  const headerRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  
  // Setup per gli effetti di scrolling
  const { scrollY } = useScroll()
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.6])
  const headerScale = useTransform(scrollY, [0, 100], [1, 0.95])
  const headerY = useTransform(scrollY, [0, 100], [0, -15])
  const formY = useTransform(scrollY, [0, 300], [0, -30])

  // Controlla se l'utente è già autenticato
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // L'utente è già autenticato, reindirizza alla home
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Calcola la forza della password
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    
    // Lunghezza minima
    if (password.length >= 8) strength += 25;
    
    // Contiene numeri
    if (/\d/.test(password)) strength += 25;
    
    // Contiene lettere minuscole e maiuscole
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    
    // Contiene caratteri speciali
    if (/[^a-zA-Z0-9]/.test(password)) strength += 25;
    
    setPasswordStrength(strength);
  }, [password]);

  // Funzione per mostrare notifiche
  const showNotification = (type: NotificationType, message: string) => {
    setNotification({ type, message });
    
    // Rimuovi la notifica dopo 5 secondi
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const handleEmailAuth = async () => {
    // Validazione
    if (!email || !password) {
      setErrorMessage("Inserisci email e password");
      return;
    }

    if (isRegistering && password !== confirmPassword) {
      setErrorMessage("Le password non corrispondono");
      return;
    }

    if (isRegistering && passwordStrength < 50) {
      setErrorMessage("La password non è abbastanza sicura");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        showNotification("success", "Registrazione avvenuta con successo!");
        // Dopo la registrazione, passa alla modalità login
        setIsRegistering(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification("success", "Accesso avvenuto con successo!");
        // Reindirizza alla home dopo il login
        setTimeout(() => {
          router.push('/');
        }, 1500);
      }
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        setErrorMessage(getFirebaseErrorMessage(error));
      } else {
        setErrorMessage("Si è verificato un errore imprevisto");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setErrorMessage("");
    setIsLoading(true);

    try {
      const providerInstance = provider === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
      await signInWithPopup(auth, providerInstance);
      showNotification("success", "Accesso avvenuto con successo!");
      // Reindirizza alla home dopo il login
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        setErrorMessage(getFirebaseErrorMessage(error));
      } else {
        setErrorMessage("Si è verificato un errore imprevisto");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const getStrengthColor = () => {
    if (passwordStrength < 25) return "bg-red-500";
    if (passwordStrength < 50) return "bg-orange-500";
    if (passwordStrength < 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (passwordStrength < 25) return "Molto debole";
    if (passwordStrength < 50) return "Debole";
    if (passwordStrength < 75) return "Media";
    return "Forte";
  };

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
      
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all transform animate-fade-in-down ${
          notification.type === 'success' ? 'bg-green-500/90' : 
          notification.type === 'error' ? 'bg-red-500/90' : 'bg-blue-500/90'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' && <FiCheck className="mr-2 h-5 w-5 text-white" />}
            {notification.type === 'error' && <FiX className="mr-2 h-5 w-5 text-white" />}
            <p className="text-white">{notification.message}</p>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="w-full max-w-md z-10">
        <motion.div 
          ref={headerRef}
          className="text-center mb-8"
          style={{ 
            opacity: headerOpacity, 
            scale: headerScale,
            y: headerY 
          }}
        >
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-200">
            {isRegistering ? "Registrati" : "Accedi"}
          </h1>
          <p className="mt-3 text-zinc-300 text-sm sm:text-base">
            {isRegistering ? "Crea un account per accedere a contenuti esclusivi" : "Accedi al tuo account per leggere contenuti esclusivi"}
          </p>
        </motion.div>
        
        {/* Auth Form con effetto parallax */}
        <motion.div 
          ref={formRef}
          style={{ y: formY }}
          className="max-w-md w-full mx-auto p-8 backdrop-blur-xl bg-zinc-800/20 border border-zinc-700 rounded-2xl shadow-2xl transition-all duration-500 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]"
        >
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-xl text-red-500 text-sm animate-fade-in">
              <div className="flex items-center">
                <FiX className="mr-2 h-5 w-5 flex-shrink-0" />
                <p>{errorMessage}</p>
              </div>
            </div>
          )}
          
          <div className="space-y-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500 group-focus-within:text-blue-500 transition-colors duration-300">
                <FiMail className="h-5 w-5" />
              </div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 p-4 bg-zinc-800/10 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-200 outline-none"
              />
            </div>
            
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500 group-focus-within:text-blue-500 transition-colors duration-300">
                <FiLock className="h-5 w-5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 p-4 bg-zinc-800/10 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-200 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300 transition-colors duration-300"
              >
                {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
              </button>
            </div>
            
            {isRegistering && password.length > 0 && (
              <div className="space-y-2 p-4 bg-zinc-800/10 backdrop-blur-sm border border-zinc-700 rounded-xl transition-all duration-500">
                <div className="flex justify-between items-center">
                  <div className="h-2 flex-grow rounded-full bg-zinc-700 overflow-hidden">
                    <div 
                      className={`h-full ${getStrengthColor()} transition-all duration-500`} 
                      style={{ width: `${passwordStrength}%` }}
                    ></div>
                  </div>
                  <span className="ml-2 text-xs font-medium text-zinc-500">{getStrengthText()}</span>
                </div>
                <ul className="text-xs text-zinc-500 space-y-1 pl-4 pt-2">
                  <li className={`transition-colors duration-300 ${password.length >= 8 ? "text-green-500" : ""}`}>
                    Almeno 8 caratteri
                  </li>
                  <li className={`transition-colors duration-300 ${/\d/.test(password) ? "text-green-500" : ""}`}>
                    Almeno un numero
                  </li>
                  <li className={`transition-colors duration-300 ${/[a-z]/.test(password) && /[A-Z]/.test(password) ? "text-green-500" : ""}`}>
                    Lettere maiuscole e minuscole
                  </li>
                  <li className={`transition-colors duration-300 ${/[^a-zA-Z0-9]/.test(password) ? "text-green-500" : ""}`}>
                    Almeno un carattere speciale
                  </li>
                </ul>
              </div>
            )}
            
            {isRegistering && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500 group-focus-within:text-blue-500 transition-colors duration-300">
                  <FiLock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Conferma Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 p-4 bg-zinc-800/10 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-200 outline-none ${
                    confirmPassword && password !== confirmPassword 
                      ? "border-red-500" 
                      : confirmPassword 
                        ? "border-green-500" 
                        : "border-zinc-700"
                  }`}
                />
                {confirmPassword && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    {password === confirmPassword ? (
                      <FiCheck className="h-5 w-5 text-green-500" />
                    ) : (
                      <FiX className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                )}
              </div>
            )}
            
            <Button
              variant="solid"
              className={`w-full py-4 bg-gradient-to-r rounded-xl from-amber-500 to-orange-600 text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-90 hover:shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02] text-base font-medium tracking-wide ${
                isLoading ? "opacity-70 pointer-events-none" : ""
              }`}
              onClick={handleEmailAuth}
              disabled={isLoading}
            >
              <FiUser className="mr-2 h-5 w-5" />
              {isLoading 
                ? "Caricamento..." 
                : isRegistering 
                  ? "Registrati" 
                  : "Accedi"
              }
            </Button>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 py-1 bg-zinc-800/10 backdrop-blur-sm text-zinc-500 rounded-full">oppure</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="ghost"
                className={`py-3 bg-zinc-800/30 backdrop-blur-sm text-zinc-200 border border-zinc-700 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:bg-zinc-700/60 hover:scale-[1.02] hover:border-zinc-700/60 ${
                  isLoading ? "opacity-70 pointer-events-none" : ""
                }`}
                onClick={() => handleOAuthLogin("google")}
                disabled={isLoading}
              >
                <div className="cursor-pointer flex items-center justify-center w-full">
                  <FcGoogle className="mr-2 h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                  <span className="font-medium">Google</span>
                </div>
              </Button>
              <Button
                variant="ghost"
                className={`py-3 bg-zinc-800/40 backdrop-blur-sm text-zinc-200 border border-zinc-700 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:bg-zinc-700/60 hover:scale-[1.02] hover:border-zinc-700/60 ${
                  isLoading ? "opacity-70 pointer-events-none" : ""
                }`}
                onClick={() => handleOAuthLogin("github")}
                disabled={isLoading}
              >
                <div className="cursor-pointer flex items-center justify-center w-full">
                  <FiGithub className="mr-2 h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                  <span className="font-medium">GitHub</span>
                </div>
              </Button>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-zinc-300">
              {isRegistering ? "Hai già un account?" : "Non hai un account?"}{" "}
              <span
                className="text-blue-500 cursor-pointer hover:underline font-medium transition-all duration-300 hover:text-blue-400"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setErrorMessage("");
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                {isRegistering ? "Accedi" : "Registrati"}
              </span>
            </p>
          </div>
        </motion.div>
        
        <div className="mt-8 text-center text-xs text-zinc-500">
          <p>Accedendo, accetti i nostri <span className="underline cursor-pointer hover:text-zinc-600 transition-colors duration-300">Termini di Servizio</span> e la <span className="underline cursor-pointer hover:text-zinc-600 transition-colors duration-300">Privacy Policy</span></p>
        </div>
      </div>
    </main>
  )
} 