"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { FiHome, FiRefreshCw, FiAlertTriangle, FiSearch } from "react-icons/fi";

interface ErrorPageProps {
  statusCode?: number;
  title?: string;
  message?: string;
  showHomeButton?: boolean;
  showRetryButton?: boolean;
  showBackButton?: boolean;
  onRetry?: () => void;
}

export default function ErrorPage({
  statusCode,
  title,
  message,
  showHomeButton = true,
  showRetryButton = false,
  showBackButton = false,
  onRetry
}: ErrorPageProps) {
  // Configurazioni predefinite basate sullo status code
  let defaultTitle = "Si è verificato un errore";
  let defaultMessage = "Ci scusiamo per l'inconveniente. È stato riscontrato un problema durante l'elaborazione della tua richiesta.";
  let IconComponent = FiAlertTriangle;
  let iconColor = "text-red-500";
  let iconBgColor = "bg-red-500/10 dark:bg-red-500/20";
  let primaryButtonColor = "from-blue-500 to-purple-600";
  
  if (statusCode === 404) {
    defaultTitle = "Pagina non trovata";
    defaultMessage = "La pagina che stai cercando non esiste o è stata spostata.";
    IconComponent = FiSearch;
    iconColor = "text-amber-500";
    iconBgColor = "bg-amber-500/10 dark:bg-amber-500/20";
    primaryButtonColor = "from-amber-500 to-orange-600";
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4 overflow-hidden">
      {/* Elementi decorativi di sfondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.05, scale: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className={`absolute -top-[30%] -right-[20%] h-[80vh] w-[80vh] rounded-full 
          ${statusCode === 404 
            ? "bg-gradient-to-br from-amber-500/20 to-orange-500/10 blur-3xl dark:from-amber-500/10 dark:to-orange-500/5" 
            : "bg-gradient-to-br from-red-500/20 to-orange-500/10 blur-3xl dark:from-red-500/10 dark:to-orange-500/5"}`}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.05, scale: 1 }}
          transition={{ duration: 2, delay: 0.3, ease: "easeOut" }}
          className="absolute -bottom-[40%] -left-[30%] h-[100vh] w-[100vh] rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/10 blur-3xl dark:from-blue-500/10 dark:to-purple-500/5"
        />
      </div>
      
      <div className="relative z-10 max-w-md w-full">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            {statusCode === 404 ? (
              <h1 className="font-serif text-8xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                <span className="inline-block animate-float" style={{ animationDelay: "0s" }}>4</span>
                <span className="inline-block animate-float" style={{ animationDelay: "0.2s" }}>0</span>
                <span className="inline-block animate-float" style={{ animationDelay: "0.4s" }}>4</span>
              </h1>
            ) : (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={`mb-4 ${iconBgColor} rounded-full p-5 w-20 h-20 flex items-center justify-center mx-auto`}
              >
                <IconComponent className={`h-10 w-10 ${iconColor}`} />
              </motion.div>
            )}
            <h2 className="text-2xl font-medium text-zinc-700 dark:text-zinc-300">
              {title || defaultTitle}
            </h2>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <p className="text-zinc-600 dark:text-zinc-400">
              {message || defaultMessage}
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {showRetryButton && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onRetry}
                className={`w-full bg-gradient-to-r ${primaryButtonColor} text-white rounded-xl px-6 py-3 font-medium shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2`}
              >
                <FiRefreshCw className="h-5 w-5" />
                <span>Riprova</span>
              </motion.button>
            )}
            
            {showHomeButton && (
              <Link href="/" className="w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`w-full ${showRetryButton ? 'bg-white/10 dark:bg-zinc-800/50 backdrop-blur-md border border-white/20 text-zinc-800 dark:text-zinc-200 hover:bg-white/20 dark:hover:bg-zinc-700/60' : `bg-gradient-to-r ${primaryButtonColor} text-white shadow-lg hover:shadow-xl`} rounded-xl px-6 py-3 font-medium transition-all duration-300 flex items-center justify-center gap-2`}
                >
                  <FiHome className="h-5 w-5" />
                  <span>Torna alla Home</span>
                </motion.button>
              </Link>
            )}
            
            {showBackButton && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.history.back()}
                className="w-full sm:w-auto bg-white/10 dark:bg-zinc-800/50 backdrop-blur-md border border-white/20 text-zinc-800 dark:text-zinc-200 rounded-xl px-6 py-3 font-medium hover:bg-white/20 dark:hover:bg-zinc-700/60 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <FiRefreshCw className="h-5 w-5" />
                <span>Torna indietro</span>
              </motion.button>
            )}
          </motion.div>
        </div>
      </div>
      
      {/* Stili per l'animazione */}
      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-pulse-slow {
          animation: pulse 3s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
} 