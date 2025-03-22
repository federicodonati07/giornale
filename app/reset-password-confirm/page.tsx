"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { FiArrowLeft, FiLock, FiCheck, FiX, FiEye, FiEyeOff } from "react-icons/fi"
import { Button } from "@heroui/react"
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth } from "../firebase"
import { motion } from "framer-motion"

export default function ResetPasswordConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [oobCode, setOobCode] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error" | "info", text: string } | null>(null)
  const [passwordStrength, setPasswordStrength] = useState(0)
  
  useEffect(() => {
    // Ottieni il codice di reset dalla query string
    const code = searchParams.get("oobCode")
    
    if (!code) {
      setMessage({ 
        type: "error", 
        text: "Link di reset non valido. Richiedi un nuovo link." 
      })
      return
    }
    
    setOobCode(code)
    
    // Verifica il codice di reset e ottieni l'email associata
    const verifyCode = async () => {
      try {
        const email = await verifyPasswordResetCode(auth, code)
        setEmail(email)
        setMessage({ 
          type: "info", 
          text: `Imposta una nuova password per ${email}` 
        })
      } catch (error) {
        console.error("Error verifying reset code:", error);
        setMessage({ 
          type: "error", 
          text: "Il link di reset non è più valido. Richiedi un nuovo link." 
        })
      }
    }
    
    verifyCode()
  }, [searchParams])
  
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
  
  const handleResetPassword = async () => {
    if (!oobCode) {
      setMessage({ type: "error", text: "Codice di reset mancante" })
      return
    }
    
    if (!password || !confirmPassword) {
      setMessage({ type: "error", text: "Inserisci una nuova password" })
      return
    }
    
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Le password non corrispondono" })
      return
    }
    
    if (passwordStrength < 50) {
      setMessage({ type: "error", text: "La password non è abbastanza sicura" })
      return
    }
    
    setIsLoading(true)
    
    try {
      await confirmPasswordReset(auth, oobCode, password)
      setMessage({ 
        type: "success", 
        text: "Password reimpostata con successo! Ora puoi accedere con la nuova password." 
      })
      
      // Reindirizza alla pagina di login dopo alcuni secondi
      setTimeout(() => {
        router.push('/access')
      }, 3000)
    } catch (error) {
      if (error instanceof FirebaseError) {
        setMessage({ type: "error", text: `Si è verificato un errore: ${error.message}` })
      } else {
        setMessage({ type: "error", text: "Si è verificato un errore imprevisto" })
      }
    } finally {
      setIsLoading(false)
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
        <Link href="/access" className="flex items-center text-zinc-200 hover:opacity-80 transition-opacity">
          <FiArrowLeft className="mr-2 h-5 w-5" />
          <span className="font-serif text-lg">Torna al login</span>
        </Link>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-br from-amber-500/10 to-orange-600/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/3 w-96 h-96 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 rounded-full filter blur-3xl"></div>
      </div>
      
      <div className="w-full max-w-md z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-200">
            Reimposta Password
          </h1>
          <p className="mt-3 text-zinc-300 text-sm sm:text-base">
            Crea una nuova password per il tuo account
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-md w-full mx-auto p-8 backdrop-blur-xl bg-zinc-800/20 border border-zinc-700 rounded-2xl shadow-2xl"
        >
          {message && (
            <div className={`mb-6 p-4 ${
              message.type === "success" 
                ? "bg-green-500/10 border-green-500/30 text-green-500" 
                : message.type === "info"
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                  : "bg-red-500/10 border-red-500/30 text-red-500"
            } backdrop-blur-sm border rounded-xl text-sm animate-fade-in`}>
              <div className="flex items-center">
                {message.type === "success" && <FiCheck className="mr-2 h-5 w-5 flex-shrink-0" />}
                {message.type === "error" && <FiX className="mr-2 h-5 w-5 flex-shrink-0" />}
                <p>{message.text}</p>
              </div>
            </div>
          )}
          
          {oobCode && email ? (
            <div className="space-y-6">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500 group-focus-within:text-blue-500 transition-colors duration-300">
                  <FiLock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Nuova password"
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
              
              {password.length > 0 && (
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
              
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500 group-focus-within:text-blue-500 transition-colors duration-300">
                  <FiLock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Conferma password"
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
              
              <Button
                variant="solid"
                className={`w-full py-4 bg-gradient-to-r rounded-xl from-amber-500 to-orange-600 text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-90 hover:shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02] text-base font-medium tracking-wide ${
                  isLoading ? "opacity-70 pointer-events-none" : ""
                }`}
                onClick={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? "Reimpostazione in corso..." : "Reimposta password"}
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-zinc-400">
                {!message?.type && "Verifica del link di reset in corso..."}
              </p>
              {message?.type === "error" && (
                <div className="mt-4">
                  <Link href="/password-reset">
                    <Button
                      variant="ghost"
                      className="py-3 bg-zinc-800/30 backdrop-blur-sm text-zinc-200 border border-zinc-700 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg hover:bg-zinc-700/60 hover:scale-[1.02] hover:border-zinc-700/60"
                    >
                      Richiedi un nuovo link
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </main>
  )
} 