"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@heroui/react"
import { FiHeart, FiUser, FiLogOut, FiPlus, FiChevronDown, FiList, FiInstagram, FiEdit, FiEye, FiShare2, FiUsers, FiFile, FiPieChart } from "react-icons/fi"
import { FeaturedNews } from "./components/FeaturedNews"
import Link from "next/link"
import { onAuthStateChanged, signOut, User } from "firebase/auth"
import { auth } from "./firebase"
import { ref, get, set, update } from "firebase/database"
import { db } from "./firebase"
import { motion } from "framer-motion"

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const [displayCount, setDisplayCount] = useState(0);
  const animationRef = useRef<number | null>(null);

  // States for counters
  const [displayTotalViews, setDisplayTotalViews] = useState(0);
  const totalViewsAnimationRef = useRef<number | null>(null);
  
  const [displayTotalLikes, setDisplayTotalLikes] = useState(0);
  const totalLikesAnimationRef = useRef<number | null>(null);
  
  // Add state for total shares
  const [displayTotalShares, setDisplayTotalShares] = useState(0);
  const totalSharesAnimationRef = useRef<number | null>(null);

  // Add state for articles submenu
  const [showArticlesSubmenu, setShowArticlesSubmenu] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // Controlla se l'utente è loggato ma non ha verificato l'email
      if (currentUser && !currentUser.emailVerified && currentUser.providerData[0]?.providerId === 'password') {
        // Se l'accesso è avvenuto con email e password e l'email non è verificata,
        // reindirizza alla pagina di verifica
        window.location.href = '/verify-email';
      }
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
        // Aggiungo un timestamp random per evitare la cache
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
          if (typeof data.count === 'number' && !isNaN(data.count)) {
            animateCount(0, data.count, 2000);
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

    // Chiamiamo subito la funzione per ottenere il conteggio aggiornato
    fetchUserCount();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []); // Mantengo la dipendenza vuota perché voglio che venga eseguito solo una volta al caricamento

  // Aggiungi una funzione per verificare e pubblicare gli articoli programmati
  useEffect(() => {
    const checkScheduledArticles = async () => {
      if (!user) return; // Solo se l'utente è autenticato

      try {
        const articlesRef = ref(db, 'articoli');
        const snapshot = await get(articlesRef);
        
        if (snapshot.exists()) {
          const now = new Date();
          const updates: Record<string, string | null> = {};
          let hasUpdates = false;
          
          snapshot.forEach((childSnapshot) => {
            const article = childSnapshot.val();
            const articleId = childSnapshot.key;
            
            // Verifica se è un articolo programmato e se la data di pubblicazione è stata raggiunta
            if (article.status === 'scheduled' && article.scheduleDate) {
              const scheduleDate = new Date(article.scheduleDate);
              
              if (scheduleDate <= now) {
                // La data di pubblicazione è stata raggiunta, aggiorna lo stato
                updates[`articoli/${articleId}/status`] = 'accepted';
                updates[`articoli/${articleId}/creazione`] = article.scheduleDate; // Imposta la data di creazione alla data programmata
                updates[`articoli/${articleId}/scheduleDate`] = null; // Rimuovi la data di programmazione
                hasUpdates = true;
                console.log(`Articolo programmato pubblicato: ${article.titolo}`);
              }
            }
          });
          
          // Aggiorna il database solo se ci sono modifiche
          if (hasUpdates) {
            await update(ref(db), updates);
            console.log('Articoli programmati aggiornati con successo');
          }
        }
      } catch (error) {
        console.error('Errore durante la verifica degli articoli programmati:', error);
      }
    };
    
    // Esegui subito e imposta un intervallo per verificare periodicamente
    checkScheduledArticles();
    
    // Puoi anche impostare un intervallo se desideri controllare periodicamente
    // durante l'utilizzo dell'app senza richiedere un ricaricamento della pagina
    const interval = setInterval(checkScheduledArticles, 60000); // Controlla ogni minuto
    
    return () => clearInterval(interval);
  }, [user]);

  // Add this function to animate the total views counter
  const animateTotalViews = (start: number, end: number, duration: number) => {
    const startTime = performance.now();
    
    const updateTotalViews = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(start + (end - start) * easeOutQuart);
      
      setDisplayTotalViews(currentCount);
      
      if (progress < 1) {
        totalViewsAnimationRef.current = requestAnimationFrame(updateTotalViews);
      }
    };
    
    totalViewsAnimationRef.current = requestAnimationFrame(updateTotalViews);
  };

  // Add a useEffect to fetch total views
  useEffect(() => {
    const fetchTotalViews = async () => {
      try {
        const articlesRef = ref(db, 'articoli');
        const snapshot = await get(articlesRef);
        
        if (snapshot.exists()) {
          let totalViews = 0;
          
          snapshot.forEach((childSnapshot) => {
            const article = childSnapshot.val();
            totalViews += article.view || 0;
          });
          
          animateTotalViews(0, totalViews, 2000);
        } else {
          animateTotalViews(0, 0, 2000);
        }
      } catch (error) {
        console.error("Errore nel recupero delle visualizzazioni totali:", error);
        animateTotalViews(0, 0, 2000);
      }
    };
    
    fetchTotalViews();
    
    return () => {
      if (totalViewsAnimationRef.current) {
        cancelAnimationFrame(totalViewsAnimationRef.current);
      }
    };
  }, []);

  // Add this function to animate the total likes counter
  const animateTotalLikes = (start: number, end: number, duration: number) => {
    const startTime = performance.now();
    
    const updateTotalLikes = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(start + (end - start) * easeOutQuart);
      
      setDisplayTotalLikes(currentCount);
      
      if (progress < 1) {
        totalLikesAnimationRef.current = requestAnimationFrame(updateTotalLikes);
      }
    };
    
    totalLikesAnimationRef.current = requestAnimationFrame(updateTotalLikes);
  };

  // Add a useEffect to fetch total likes
  useEffect(() => {
    const fetchTotalLikes = async () => {
      try {
        const articlesRef = ref(db, 'articoli');
        const snapshot = await get(articlesRef);
        
        if (snapshot.exists()) {
          let totalLikes = 0;
          
          snapshot.forEach((childSnapshot) => {
            const article = childSnapshot.val();
            totalLikes += article.upvote || 0;
          });
          
          animateTotalLikes(0, totalLikes, 2000);
        } else {
          animateTotalLikes(0, 0, 2000);
        }
      } catch (error) {
        console.error("Errore nel recupero dei like totali:", error);
        animateTotalLikes(0, 0, 2000);
      }
    };
    
    fetchTotalLikes();
    
    return () => {
      if (totalLikesAnimationRef.current) {
        cancelAnimationFrame(totalLikesAnimationRef.current);
      }
    };
  }, []);

  // Add this function to animate the total shares counter
  const animateTotalShares = (start: number, end: number, duration: number) => {
    const startTime = performance.now();
    
    const updateTotalShares = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(start + (end - start) * easeOutQuart);
      
      setDisplayTotalShares(currentCount);
      
      if (progress < 1) {
        totalSharesAnimationRef.current = requestAnimationFrame(updateTotalShares);
      }
    };
    
    totalSharesAnimationRef.current = requestAnimationFrame(updateTotalShares);
  };

  // Add a useEffect to fetch total shares
  useEffect(() => {
    const fetchTotalShares = async () => {
      try {
        const articlesRef = ref(db, 'articoli');
        const snapshot = await get(articlesRef);
        
        if (snapshot.exists()) {
          let totalShares = 0;
          
          snapshot.forEach((childSnapshot) => {
            const article = childSnapshot.val();
            totalShares += article.shared || 0;
          });
          
          animateTotalShares(0, totalShares, 2000);
        } else {
          animateTotalShares(0, 0, 2000);
        }
      } catch (error) {
        console.error("Errore nel recupero delle condivisioni totali:", error);
        animateTotalShares(0, 0, 2000);
      }
    };
    
    fetchTotalShares();
    
    return () => {
      if (totalSharesAnimationRef.current) {
        cancelAnimationFrame(totalSharesAnimationRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800 overflow-x-hidden">
      {/* Stili per l'animazione del menu e animazioni personalizzate */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        @keyframes shine {
          0% { background-position: -100px; }
          60%, 100% { background-position: 200px; }
        }
        .animate-shine {
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          background-size: 200px 100%;
          background-repeat: no-repeat;
          background-position: -100px;
          animation: shine 2s infinite;
        }
      `}</style>
      
      {/* Elementi decorativi di sfondo con parallax */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.05, scale: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute -top-[30%] -right-[20%] h-[80vh] w-[80vh] rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 blur-3xl dark:from-amber-500/10 dark:to-orange-500/5"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.05, scale: 1 }}
          transition={{ duration: 2, delay: 0.3, ease: "easeOut" }}
          className="absolute -bottom-[40%] -left-[30%] h-[100vh] w-[100vh] rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/10 blur-3xl dark:from-blue-500/10 dark:to-purple-500/5"
        />
      </div>
      
      {/* Login/User Button */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute top-4 right-4 sm:top-6 sm:right-8 z-[50]"
      >
        {loading ? (
          <div className="h-10 w-24 bg-white/10 animate-pulse rounded-full"></div>
        ) : user ? (
          <div className="flex items-center gap-3 relative z-[9998]" ref={userMenuRef}>
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
              <div className="absolute right-0 top-12 w-48 py-2 bg-white/80 dark:bg-zinc-800/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/30 dark:border-white/10 z-[9999] transform origin-top-right transition-all duration-300 animate-fade-in">
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
                    {/* Show Add Article button only for admins who are not superior */}
                    {!isSuperior && (
                    <Link href="/admin/new-article">
                      <div className="flex items-center px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-blue-500/10 hover:text-blue-500 rounded-lg transition-all duration-300 cursor-pointer">
                        <FiPlus className="mr-2 h-4 w-4" />
                        Aggiungi Articolo
                      </div>
                    </Link>
                    )}
                    {isSuperior && (
                      <>
                        {/* Dashboard as a separate menu item */}
                        <Link href="/admin/dashboard">
                          <div className="flex items-center px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-amber-300/10 hover:text-amber-400 rounded-lg transition-all duration-300 cursor-pointer">
                            <FiPieChart className="mr-2 h-4 w-4" />
                            Dashboard
                          </div>
                        </Link>
                        
                        {/* Articoli parent menu with submenu */}
                        <div 
                          className="relative flex items-center justify-between px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-emerald-500/10 hover:text-emerald-500 rounded-lg transition-all duration-300 cursor-pointer"
                          onClick={() => setShowArticlesSubmenu(!showArticlesSubmenu)}
                        >
                          <div className="flex items-center">
                            <FiFile className="mr-2.5 h-4 w-4" />
                            <span>Articoli</span>
                          </div>
                          
                          {/* Badge for pending reviews */}
                          {pendingReviewCount > 0 && (
                            <div className="h-5 w-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg border border-white/20">
                              <span className="text-white text-xs font-bold">{pendingReviewCount > 9 ? '9+' : pendingReviewCount}</span>
                            </div>
                          )}
                          
                          {/* Dropdown arrow */}
                          <FiChevronDown className={`ml-1.5 h-3 w-3 text-zinc-500 transition-transform duration-300 ${showArticlesSubmenu ? 'rotate-180' : ''}`} />
                        </div>
                        
                        {/* Submenu for articles management */}
                        {showArticlesSubmenu && (
                          <div className="ml-2 mt-1 border-l-2 border-white/30 dark:border-white/10 pl-2">
                            <Link href="/admin/new-article">
                              <div className="flex items-center px-2.5 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-sky-500/10 hover:text-sky-500 rounded-lg transition-all duration-300 cursor-pointer">
                                <FiPlus className="mr-2 h-4 w-4" />
                                Aggiungi Articolo
                              </div>
                            </Link>
                            <Link href="/admin/manage-articles">
                              <div className="flex items-center px-2.5 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-rose-500/10 hover:text-rose-500 rounded-lg transition-all duration-300 cursor-pointer">
                                <FiList className="mr-2 h-4 w-4" />
                                Gestione Articoli
                              </div>
                            </Link>
                            <Link href="/admin/review-articles">
                              <div className="flex items-center justify-between px-2.5 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-purple-500/10 hover:text-purple-500 rounded-lg transition-all duration-300 cursor-pointer">
                                <div className="flex items-center">
                                  <FiEdit className="mr-2 h-4 w-4" />
                                  <span className="mr-2">Revisione Articoli</span>
                                </div>
                                {pendingReviewCount > 0 && (
                                  <div className="inline-flex h-5 w-5 bg-red-500 rounded-full items-center justify-center shadow-lg border border-white/20">
                                    <span className="text-white text-xs font-bold">{pendingReviewCount > 9 ? '9+' : pendingReviewCount}</span>
                                  </div>
                                )}
                              </div>
                            </Link>
                          </div>
                        )}
                      </>
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
      </motion.div>

      <div className="container mx-auto px-4 pt-16 sm:pt-24 md:pt-32 relative">
        <div className="flex flex-col items-center justify-center space-y-8 sm:space-y-12 text-center">
          {/* Title senza effetto parallax */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative z-[5]"
          >
            <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 relative">
              <span className="inline-block animate-float" style={{ animationDelay: "0s" }}>S</span>
              <span className="inline-block animate-float" style={{ animationDelay: "0.1s" }}>T</span>
              <span className="inline-block animate-float" style={{ animationDelay: "0.2s" }}>E</span>
              <span className="inline-block animate-float" style={{ animationDelay: "0.3s" }}>E</span>
              <span className="inline-block animate-float" style={{ animationDelay: "0.4s" }}>L</span>
              <span className="inline-block animate-float" style={{ animationDelay: "0.5s" }}>E</span>
              <span className="inline-block ml-5 animate-float" style={{ animationDelay: "0.6s" }}>N</span>
              <span className="inline-block animate-float" style={{ animationDelay: "0.7s" }}>E</span>
              <span className="inline-block animate-float" style={{ animationDelay: "0.8s" }}>W</span>
              <span className="inline-block animate-float" style={{ animationDelay: "0.9s" }}>S</span>
            </h1>
          </motion.div>

          {/* Stats Counters with ultra-modern UI */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="flex flex-col items-center space-y-3"
          >
            {/* Desktop layout - separate containers */}
            <div className="hidden md:block w-full">
              {/* Community/Users count with premium design */}
              <motion.div 
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-amber-600/5 dark:from-amber-400/10 dark:to-amber-700/5 backdrop-blur-md px-7 py-3 rounded-2xl border border-amber-200/20 dark:border-amber-500/10 shadow-lg shadow-amber-500/5 mb-3"
              >
                <div className="flex items-center">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-amber-400/20 rounded-full blur-md"></div>
                    <div className="relative bg-gradient-to-br from-amber-300 to-amber-500 p-2 rounded-full">
                      <FiUsers className="text-white h-5 w-5" />
                    </div>
                  </div>
                  <div className="ml-3 pl-3 border-l border-amber-200/20 dark:border-amber-500/20">
                    <span className="block font-bold text-xl text-zinc-800 dark:text-zinc-100">
                {displayCount.toLocaleString()}
              </span>
                    <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">community</span>
                  </div>
                </div>
              </motion.div>
              
              {/* Content stats in separate boxes */}
              <div className="grid grid-cols-3 gap-3">
                {/* Views stat in its own box */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-400/10 dark:to-blue-700/5 backdrop-blur-md px-5 py-3 rounded-2xl border border-blue-200/20 dark:border-blue-500/10 shadow-lg shadow-blue-500/5"
                >
                  <div className="flex flex-col items-center">
                    <div className="relative mb-1">
                      <div className="absolute -inset-1 bg-blue-400/20 rounded-full blur-md"></div>
                      <div className="relative bg-gradient-to-br from-blue-400 to-blue-600 p-2 rounded-full">
                        <FiEye className="text-white h-5 w-5" />
                      </div>
                    </div>
                    <span className="block font-bold text-lg text-zinc-800 dark:text-zinc-100 mt-1">
                      {displayTotalViews.toLocaleString()}
                    </span>
                    <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">views</span>
                  </div>
                </motion.div>
                
                {/* Likes stat in its own box */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-center justify-center bg-gradient-to-br from-rose-500/10 to-rose-600/5 dark:from-rose-400/10 dark:to-rose-700/5 backdrop-blur-md px-5 py-3 rounded-2xl border border-rose-200/20 dark:border-rose-500/10 shadow-lg shadow-rose-500/5"
                >
                  <div className="flex flex-col items-center">
                    <div className="relative mb-1">
                      <div className="absolute -inset-1 bg-rose-400/20 rounded-full blur-md"></div>
                      <div className="relative bg-gradient-to-br from-rose-400 to-rose-600 p-2 rounded-full">
                        <FiHeart className="text-white h-5 w-5" />
                      </div>
                    </div>
                    <span className="block font-bold text-lg text-zinc-800 dark:text-zinc-100 mt-1">
                      {displayTotalLikes.toLocaleString()}
                    </span>
                    <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">likes</span>
                  </div>
                </motion.div>
                
                {/* Shares stat in its own box */}
                <motion.div 
                  whileHover={{ y: -3 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-center justify-center bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-400/10 dark:to-emerald-700/5 backdrop-blur-md px-5 py-3 rounded-2xl border border-emerald-200/20 dark:border-emerald-500/10 shadow-lg shadow-emerald-500/5"
                >
                  <div className="flex flex-col items-center">
                    <div className="relative mb-1">
                      <div className="absolute -inset-1 bg-emerald-400/20 rounded-full blur-md"></div>
                      <div className="relative bg-gradient-to-br from-emerald-400 to-emerald-600 p-2 rounded-full">
                        <FiShare2 className="text-white h-5 w-5" />
                      </div>
                    </div>
                    <span className="block font-bold text-lg text-zinc-800 dark:text-zinc-100 mt-1">
                      {displayTotalShares.toLocaleString()}
              </span>
                    <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">shares</span>
                  </div>
                </motion.div>
              </div>
            </div>
            
            {/* Mobile layout - 1x2 grid with individual boxes */}
            <div className="md:hidden w-full grid grid-cols-2 gap-2">
              {/* Community stat in its own box */}
              <motion.div 
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-amber-600/5 dark:from-amber-400/10 dark:to-amber-700/5 backdrop-blur-md p-3 rounded-2xl border border-amber-200/20 dark:border-amber-500/10 shadow-lg shadow-amber-500/5"
              >
                <div className="flex flex-col items-center">
                  <div className="relative mb-1">
                    <div className="absolute -inset-1 bg-amber-400/20 rounded-full blur-md"></div>
                    <div className="relative bg-gradient-to-br from-amber-300 to-amber-500 p-1.5 rounded-full">
                      <FiUsers className="text-white h-4 w-4" />
                    </div>
                  </div>
                  <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 mt-1">
                    {displayCount.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">community</span>
                </div>
              </motion.div>
              
              {/* Views stat in its own box */}
              <motion.div 
                whileHover={{ y: -2 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-400/10 dark:to-blue-700/5 backdrop-blur-md p-3 rounded-2xl border border-blue-200/20 dark:border-blue-500/10 shadow-lg shadow-blue-500/5"
              >
                <div className="flex flex-col items-center">
                  <div className="relative mb-1">
                    <div className="absolute -inset-1 bg-blue-400/20 rounded-full blur-md"></div>
                    <div className="relative bg-gradient-to-br from-blue-400 to-blue-600 p-1.5 rounded-full">
                      <FiEye className="text-white h-4 w-4" />
                    </div>
                  </div>
                  <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100 mt-1">
                {displayTotalViews.toLocaleString()}
              </span>
                  <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">views</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
          
          {/* Decorative line con animazione */}
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "6rem", opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="h-[1px] bg-zinc-800 dark:bg-zinc-200"
          />

          {/* Topics Navigation con staggered animation */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-4xl"
          >
            {topics.map((topic, index) => (
              <motion.div
                key={topic}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 1 + index * 0.05 }}
              >
                <Link href={`/articles?tag=${encodeURIComponent(topic)}`}>
                  <Button
                    variant="bordered"
                    className="cursor-pointer text-xs sm:text-sm font-medium tracking-wider font-sans rounded-full hover:bg-zinc-800 hover:text-zinc-100 transition-all duration-500 ease-in-out"
                  >
                    {topic}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Support Button and Instagram Icon con animazione - ripristinato colore originale */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 1.2 }}
            className="flex items-center gap-4"
          >
            <Button
              variant="solid"
              className="bg-gradient-to-r rounded-full from-amber-500 to-orange-600 text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-80 hover:shadow-2xl hover:scale-105 text-sm sm:text-base font-medium tracking-wide"
            >
              <FiHeart className="mr-2 h-4 w-4" />
              Supporta il progetto
            </Button>

            <motion.a 
              href="https://www.instagram.com/_steelenews_/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-white/10 dark:bg-zinc-800/50 backdrop-blur-md border border-white/20 text-zinc-800 dark:text-zinc-200 hover:bg-white/20 dark:hover:bg-zinc-700/60 transition-all duration-300"
              whileHover={{ rotate: 10, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FiInstagram className="h-5 w-5" />
            </motion.a>
          </motion.div>

          {/* Featured News Section con fade in */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.4 }}
            className="w-full"
          >
            <FeaturedNews />
          </motion.div>
        </div>
      </div>

      {/* Sezione Contattaci con effetto parallax */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 1.6 }}
        className="mt-24 sm:mt-32 py-12 sm:py-16 bg-white/5 dark:bg-zinc-800/30 backdrop-blur-md border-t border-white/10 relative"
      >
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.8 }}
              className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6"
            >
              Contattaci
            </motion.h2>
            
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "4rem" }}
              transition={{ duration: 0.8, delay: 2 }}
              className="h-[1px] bg-zinc-400 dark:bg-zinc-500 mb-8"
            />
            
            {/* Link social e sito con staggered animation */}
            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <motion.a 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 2.1 }}
                whileHover={{ scale: 1.05 }}
                href="https://www.instagram.com/_steelenews_/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl transition-all duration-300 hover:shadow-lg hover:opacity-90"
              >
                <FiInstagram className="h-5 w-5" />
                <span>Profilo Instagram</span>
              </motion.a>
              
              <motion.a 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 2.2 }}
                whileHover={{ scale: 1.05 }}
                href="https://federicodonati.netlify.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl transition-all duration-300 hover:shadow-lg hover:opacity-90"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span>Contatta il Developer</span>
              </motion.a>
            </div>
            
            {/* Fondatori con animazione */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 2.3 }}
              className="text-center mb-8"
            >
              <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-200 mb-3">
                I Fondatori
              </h3>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {["Federico Donati", "Francesco Maria Torella", "Federica De Ferrari", "Davide Simoni", "Lorenzo Brunetti"].map((name, index) => (
                  <motion.span 
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 2.4 + index * 0.1 }}
                    whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }}
                    className="inline-block px-3 py-1.5 bg-white/10 dark:bg-zinc-800/50 backdrop-blur-sm rounded-full text-sm text-zinc-700 dark:text-zinc-300 border border-white/20"
                  >
                    {name}
                  </motion.span>
                ))}
              </div>
            </motion.div>
            
            {/* Copyright */}
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 2.8 }}
              className="text-sm text-zinc-500 dark:text-zinc-400"
            >
              © {new Date().getFullYear()} STEELE NEWS. Tutti i diritti riservati.
            </motion.p>
          </div>
        </div>
      </motion.div>
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