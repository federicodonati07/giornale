"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@heroui/react"
import { FiHeart, FiUser, FiLogOut, FiPlus, FiChevronDown, FiList, FiInstagram, FiEdit } from "react-icons/fi"
import { FeaturedNews } from "./components/FeaturedNews"
import Link from "next/link"
import { onAuthStateChanged, signOut, User } from "firebase/auth"
import { auth } from "./firebase"
import { ref, get, set } from "firebase/database"
import { db } from "./firebase"


export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const [displayCount, setDisplayCount] = useState(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Ottieni il numero di articoli in attesa di revisione
  useEffect(() => {
    const fetchPendingReviewArticles = async () => {
      if (!user) return;
      
      // Controlla se l'utente è un revisore superiore
      const superiorEmails = JSON.parse(process.env.NEXT_PUBLIC_SUPERIOR_EMAILS || "[]");
      if (!superiorEmails.includes(user.email)) return;
      
      try {
        const articlesRef = ref(db, 'articoli');
        const snapshot = await get(articlesRef);
        
        if (snapshot.exists()) {
          let count = 0;
          
          snapshot.forEach((childSnapshot) => {
            const article = childSnapshot.val();
            if (article.status === 'revision') {
              count++;
            }
          });
          
          setPendingReviewCount(count);
        } else {
          setPendingReviewCount(0);
        }
      } catch (error) {
        console.error("Errore nel recupero degli articoli da revisionare:", error);
      }
    };
    
    fetchPendingReviewArticles();
  }, [user]);

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
  const isAdmin = user?.email && JSON.parse(
    process.env.NEXT_PUBLIC_ADMIN_EMAILS || "[]"
  ).includes(user.email);

  // Controlla se l'utente è un revisore superiore
  const isSuperior = user?.email && JSON.parse(
    process.env.NEXT_PUBLIC_SUPERIOR_EMAILS || "[]"
  ).includes(user.email);

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

  // Funzione per animare il conteggio
  const animateCount = (start: number, end: number, duration: number) => {
    const startTime = performance.now();
    
    const updateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function per un'animazione più fluida
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(start + (end - start) * easeOutQuart);
      
      setDisplayCount(currentCount);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(updateCount);
      }
    };
    
    animationRef.current = requestAnimationFrame(updateCount);
  };

  // Ottieni il conteggio degli utenti
  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        console.log("Inizio recupero conteggio utenti...");
        // Aggiungiamo un timestamp per evitare la cache del browser
        const response = await fetch('/api/user-count?t=' + Date.now());
        
        console.log("Risposta API ricevuta:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error(`Risposta del server non valida: ${response.status}`, errorText);
          throw new Error(`Risposta del server non valida: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Risposta API conteggio utenti:", data);
        
        if (data.success) {
          // Anima il conteggio solo se abbiamo un valore valido
          if (typeof data.count === 'number' && !isNaN(data.count)) {
            animateCount(0, data.count, 2000);
            
            // Opzionale: aggiorna anche il conteggio nel database per riferimento futuro
            // Solo gli admin possono scrivere sul database
            if (isAdmin) {
              try {
                const usersCountRef = ref(db, 'metadata/userCount');
                await set(usersCountRef, data.count);
              } catch (dbError) {
                console.error("Errore nel salvataggio del conteggio su DB:", dbError);
              }
            }
          } else {
            console.error("Conteggio utenti non valido:", data.count);
            fallbackToDefaultCount();
          }
        } else {
          console.error("Errore API:", data.error, data.message || "Nessun messaggio di errore");
          fallbackToDBCount();
        }
      } catch (error) {
        console.error("Errore nel recupero del conteggio utenti:", error);
        fallbackToDBCount();
      }
    };

    // Funzione per il fallback al conteggio dal database
    const fallbackToDBCount = async () => {
      // Rimuoviamo il controllo sull'utente, permettendo a tutti di leggere il conteggio
      try {
        const usersCountRef = ref(db, 'metadata/userCount');
        const snapshot = await get(usersCountRef);
        
        if (snapshot.exists() && typeof snapshot.val() === 'number') {
          console.log("Recuperato conteggio dal database:", snapshot.val());
          animateCount(0, snapshot.val(), 2000);
        } else {
          fallbackToDefaultCount();
        }
      } catch (dbError) {
        console.error("Errore recupero conteggio dal DB:", dbError);
        fallbackToDefaultCount();
      }
    };

    // Funzione per il fallback a un valore predefinito
    const fallbackToDefaultCount = () => {
      console.log("Utilizzo conteggio utenti predefinito");
      animateCount(0, 15, 2000);  // Mostra subito un numero, anche prima di tentare la chiamata API
    };

    // Per ora, mostriamo sempre un valore predefinito
    animateCount(0, 15, 2000);  // Mostra subito un numero, anche prima di tentare la chiamata API
    
    // Tentiamo comunque di ottenere il numero reale
    fetchUserCount();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
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
              <div className="relative">
                <FiUser className="mr-2 h-4 w-4 text-zinc-800 dark:text-zinc-200" />
              </div>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[150px]">
                {getUserDisplayName()}
              </span>
              <FiChevronDown className={`ml-2 h-4 w-4 text-zinc-500 transition-transform duration-300 ${showUserMenu ? 'rotate-180' : ''}`} />
              
              {/* Badge posizionato all'estrema destra */}
              {isSuperior && pendingReviewCount > 0 && (
                <div className="absolute -right-2 top-0 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg border border-white/20">
                  <span className="text-white text-xs font-bold">{pendingReviewCount > 9 ? '9+' : pendingReviewCount}</span>
                </div>
              )}
            </div>
            
            {/* Menu a tendina */}
            {showUserMenu && (
              <div className="absolute right-0 top-12 w-48 py-2 bg-white/80 dark:bg-zinc-800/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/30 dark:border-white/10 z-50 transform origin-top-right transition-all duration-300 animate-fade-in">
                <div className="px-2">
                  <Link href="/favorites">
                    <div className="flex items-center px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-amber-500/10 hover:text-amber-500 rounded-lg transition-all duration-300 cursor-pointer">
                      <FiHeart className="mr-2 h-4 w-4" />
                      Articoli Preferiti
                    </div>
                  </Link>
                </div>
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
                    {isSuperior && (
                      <Link href="/admin/review-articles">
                        <div className="relative flex items-center px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-purple-500/10 hover:text-purple-500 rounded-lg transition-all duration-300 cursor-pointer">
                          <FiEdit className="mr-2 h-4 w-4" />
                          <span>Revisione Articoli</span>
                          
                          {/* Badge posizionato all'estrema destra */}
                          {pendingReviewCount > 0 && (
                            <div className="absolute right-2 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg border border-white/20">
                              <span className="text-white text-xs font-bold">{pendingReviewCount > 9 ? '9+' : pendingReviewCount}</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    )}
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
          {/* Title */}
          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            PAXMAN NEWS
          </h1>

          {/* User Counter */}
          <div className="flex flex-col items-center space-y-1">
            <div className="flex items-baseline gap-2 text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-base">
                {displayCount.toLocaleString()}
              </span>
              <span className="text-sm">
                utenti registrati
              </span>
            </div>
          </div>
          
          {/* Decorative line */}
          <div className="w-16 sm:w-24 h-[1px] bg-zinc-800 dark:bg-zinc-200" />

          {/* Topics Navigation */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-4xl">
            {topics.map((topic) => (
              <Link 
                key={topic}
                href={`/articles?tag=${encodeURIComponent(topic)}`}
              >
                <Button
                  variant="bordered"
                  className="cursor-pointer text-xs sm:text-sm font-medium tracking-wider font-sans rounded-full hover:bg-zinc-800 hover:text-zinc-100 transition-all duration-500 ease-in-out"
                >
                  {topic}
                </Button>
              </Link>
            ))}
          </div>

          {/* Support Button and Instagram Icon */}
          <div className="flex items-center gap-4">
            <Button
              variant="solid"
              className="bg-gradient-to-r rounded-full from-amber-500 to-orange-600 text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-80 hover:shadow-2xl hover:scale-105 text-sm sm:text-base font-medium tracking-wide"
            >
              <FiHeart className="mr-2 h-4 w-4" />
              Supporta il progetto
            </Button>

            <a 
              href="https://www.instagram.com/il_paxman/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-white/10 dark:bg-zinc-800/50 backdrop-blur-md border border-white/20 text-zinc-800 dark:text-zinc-200 hover:bg-white/20 dark:hover:bg-zinc-700/60 transition-all duration-300"
            >
              <FiInstagram className="h-5 w-5" />
            </a>
          </div>

          {/* Featured News Section */}
          <FeaturedNews />
        </div>
      </div>

      {/* Sezione Contattaci */}
      <div className="mt-24 sm:mt-32 py-12 sm:py-16 bg-white/5 dark:bg-zinc-800/30 backdrop-blur-md border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">
              Contattaci
            </h2>
            
            <div className="w-16 h-[1px] bg-zinc-400 dark:bg-zinc-500 mb-8"></div>
            
            {/* Link social e sito */}
            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <a 
                href="https://www.instagram.com/il_paxman/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl transition-all duration-300 hover:shadow-lg hover:opacity-90"
              >
                <FiInstagram className="h-5 w-5" />
                <span>Profilo Instagram</span>
              </a>
              
              <a 
                href="https://federicodonati.netlify.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl transition-all duration-300 hover:shadow-lg hover:opacity-90"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span>Contatta il Developer</span>
              </a>
            </div>
            
            {/* Fondatori */}
            <div className="text-center mb-8">
              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">
                I Fondatori
              </h3>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {["Federico Donati", "Francesco Maria Torella", "Federica De Ferrari", "Davide Simoni", "Lorenzo Brunetti"].map((name, index) => (
                  <span 
                    key={index}
                    className="inline-block px-3 py-1.5 bg-white/10 dark:bg-zinc-800/50 backdrop-blur-sm rounded-full text-sm text-zinc-700 dark:text-zinc-300 border border-white/20"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Copyright */}
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              © {new Date().getFullYear()} PAXMAN NEWS. Tutti i diritti riservati.
            </p>
          </div>
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
  "SCIENZE & NATURA",
  "MEDICINA",
  "ARTE & CULTURA",
  "ITALIA"
] 