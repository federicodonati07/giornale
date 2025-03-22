"use client"

import { useState } from "react"
import Link from "next/link"
import { FiArrowLeft, FiMail, FiCheck } from "react-icons/fi"
import { Button } from "@heroui/react"
import { sendPasswordResetEmail } from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth } from "../firebase"
import { motion } from "framer-motion"

export default function PasswordResetPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null)
  
  const handleResetPassword = async () => {
    if (!email) {
      setMessage({ type: "error", text: "Inserisci un indirizzo email" })
      return
    }
    
    setIsLoading(true)
    setMessage(null)
    
    try {
      // Configurazione dell'URL di azione personalizzato
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password-confirm`,
        handleCodeInApp: true
      }
      
      await sendPasswordResetEmail(auth, email, actionCodeSettings)
      setMessage({ 
        type: "success", 
        text: "Email inviata con successo! Controlla la tua casella di posta e segui le istruzioni." 
      })
    } catch (error) {
      if (error instanceof FirebaseError) {
        // Gestire errori specifici
        if (error.code === "auth/user-not-found") {
          setMessage({ type: "error", text: "Nessun account associato a questa email" })
        } else {
          setMessage({ type: "error", text: `Si è verificato un errore: ${error.message}` })
        }
      } else {
        setMessage({ type: "error", text: "Si è verificato un errore imprevisto" })
      }
    } finally {
      setIsLoading(false)
    }
  }
  
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
            Inserisci la tua email per ricevere un link di reset
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
                : "bg-red-500/10 border-red-500/30 text-red-500"
            } backdrop-blur-sm border rounded-xl text-sm animate-fade-in`}>
              <div className="flex items-center">
                {message.type === "success" && <FiCheck className="mr-2 h-5 w-5 flex-shrink-0" />}
                <p>{message.text}</p>
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
            
            <Button
              variant="solid"
              className={`w-full py-4 bg-gradient-to-r rounded-xl from-amber-500 to-orange-600 text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-90 hover:shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02] text-base font-medium tracking-wide ${
                isLoading ? "opacity-70 pointer-events-none" : ""
              }`}
              onClick={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? "Invio in corso..." : "Invia link di reset"}
            </Button>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-sm text-zinc-300">
              Ricordi la tua password?{" "}
              <Link href="/access" className="text-blue-500 hover:underline font-medium transition-all duration-300 hover:text-blue-400">
                Accedi
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  )
}