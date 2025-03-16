"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@heroui/react"
import { FiHeart, FiUser, FiLogOut, FiPlus, FiChevronDown, FiList } from "react-icons/fi"
import { FeaturedNews } from "./components/FeaturedNews"
import Link from "next/link"
import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth"

// Configura Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: "https://giornalino-c2682-default-rtdb.europe-west1.firebasedatabase.app/"
}

// Inizializza Firebase solo se non è già stato inizializzato
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
const auth = getAuth(app)

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Errore durante il logout:", error);
    }
  };

  // Ottieni il nome visualizzato dell'utente
  const getUserDisplayName = () => {
    if (!user) return "";
    
    // Priorità: displayName, email, uid
    return user.displayName || user.email || user.uid;
  };

  // Controlla se l'utente è un amministratore
  const isAdmin = user?.email === "realeaquila.929@gmail.com";

  // Chiudi il menu quando si clicca fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800">
      {/* Stili per l'animazione del menu */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
      `}</style>
      
      {/* Login/User Button */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
        {loading ? (
          <div className="h-10 w-24 bg-white/10 animate-pulse rounded-full"></div>
        ) : user ? (
          <div className="flex items-center gap-3 relative" ref={userMenuRef}>
            <div 
              className="flex items-center bg-white/10 dark:bg-zinc-800/50 backdrop-blur-md rounded-full py-2 px-4 border border-white/20 cursor-pointer hover:bg-white/20 dark:hover:bg-zinc-700/60 transition-all duration-300"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <FiUser className="mr-2 h-4 w-4 text-zinc-800 dark:text-zinc-200" />
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]">
                {getUserDisplayName()}
              </span>
              <FiChevronDown className={`ml-2 h-4 w-4 text-zinc-500 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
            </div>
            
            {/* Menu a tendina */}
            {showUserMenu && (
              <div className="absolute right-0 top-12 w-48 py-2 bg-white/80 dark:bg-zinc-800/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/30 dark:border-white/10 z-50 transform origin-top-right transition-all duration-300 animate-fade-in">
                {isAdmin && (
                  <div className="px-2">
                    <Link href="/admin/new-article">
                      <div className="flex items-center px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-blue-500/10 hover:text-blue-500 rounded-lg transition-all duration-300 cursor-pointer">
                        <FiPlus className="mr-2 h-4 w-4" />
                        Aggiungi Articolo
                      </div>
                    </Link>
                    <Link href="/admin/manage-articles">
                      <div className="flex items-center px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-blue-500/10 hover:text-blue-500 rounded-lg transition-all duration-300 cursor-pointer">
                        <FiList className="mr-2 h-4 w-4" />
                        Gestisci Articoli
                      </div>
                    </Link>
                    <div className="my-1 border-t border-zinc-200 dark:border-zinc-700"></div>
                  </div>
                )}
                <div className="px-2">
                  <div 
                    className="flex items-center px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-300 cursor-pointer"
                    onClick={handleSignOut}
                  >
                    <FiLogOut className="mr-2 h-4 w-4" />
                    Logout
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link href="/access">
            <Button
              variant="ghost"
              className="cursor-pointer bg-white/10 dark:bg-zinc-800/50 backdrop-blur-md rounded-full py-2 px-4 border border-white/20 text-zinc-800 dark:text-zinc-200 shadow-lg transition-all duration-500 ease-in-out hover:bg-white/20 dark:hover:bg-zinc-700/60 hover:border-white/30 hover:shadow-xl hover:scale-[1.02]"
            >
              <FiUser className="mr-2 h-4 w-4" />
              <span className="font-medium">Accedi</span>
            </Button>
          </Link>
        )}
      </div>

      <div className="container mx-auto px-4 pt-16 sm:pt-24 md:pt-32">
        <div className="flex flex-col items-center justify-center space-y-8 sm:space-y-12 text-center">
          {/* Title with elegant serif font */}
          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            GIORNALE
          </h1>
          
          {/* Decorative line */}
          <div className="w-16 sm:w-24 h-[1px] bg-zinc-800 dark:bg-zinc-200" />

          {/* Topics Navigation */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-4xl">
            {topics.map((topic) => (
              <Button
                key={topic}
                variant="bordered"
                className="cursor-pointer text-xs sm:text-sm font-medium tracking-wider font-sans rounded-full hover:bg-zinc-800 hover:text-zinc-100 transition-all duration-500 ease-in-out"
              >
                {topic}
              </Button>
            ))}
          </div>

          {/* Support Button */}
          <div className="flex items-center">
            <Button
              variant="solid"
              className="bg-gradient-to-r rounded-full from-amber-500 to-orange-600 text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-80 hover:shadow-2xl hover:scale-105 text-sm sm:text-base font-medium tracking-wide"
            >
              <FiHeart className="mr-2 h-4 w-4" />
              Supporta il progetto
            </Button>
          </div>

          {/* Featured News Section */}
          <FeaturedNews />
        </div>
      </div>
    </main>
  )
}

const topics = [
  "ATTUALITÀ",
  "POLITICA",
  "ESTERO",
  "ECONOMIA",
  "TECNOLOGIA",
  "SPORT",
  "AVIAZIONE",
  "SCIENZE",
  "MODA",
  "ITALIA"
] 