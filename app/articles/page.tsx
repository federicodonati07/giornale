"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ref, get, update, increment } from "firebase/database"
import { db } from "../firebase"
import { FiHeart, FiShare2, FiEye, FiClock, FiArrowLeft, FiUser, FiFilter } from "react-icons/fi"
import { LuFilterX, LuClockArrowUp, LuClockArrowDown } from "react-icons/lu"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { AnimatedCounter } from "../components/AnimatedCounter"
import { auth } from "../firebase"

interface ArticleData {
  uuid: string
  titolo: string
  contenuto: string
  tag: string
  immagine: string
  autore: string
  creazione: string
  upvote: number
  shared: number
  view: number
  status?: string
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
  "ITALIA",
  "STORIA"
]

// Aggiungi un'interfaccia per gli autori con conteggio
interface AuthorWithCount {
  name: string;
  count: number;
}

export default function Articles() {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filteredArticles, setFilteredArticles] = useState<ArticleData[]>([])
  
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<'date' | 'upvote' | 'view' | 'shared'>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  
  // Aggiungiamo uno stato per tenere traccia di quanti articoli mostrare
  const [displayLimit, setDisplayLimit] = useState(5);
  
  // Modifichiamo il calcolo degli articoli da visualizzare
  const displayedArticles = filteredArticles.slice(0, displayLimit);
  
  // Funzione per caricare più articoli
  const loadMoreArticles = () => {
    setDisplayLimit(prev => prev + 5);
  };

  // Aggiungi lo state per l'utente
  const [user, setUser] = useState(auth.currentUser);

  // Aggiungi useEffect per monitorare lo stato dell'autenticazione
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const articlesRef = ref(db, 'articoli')
        const snapshot = await get(articlesRef)
        
        if (snapshot.exists()) {
          const articlesData: ArticleData[] = []
          
          snapshot.forEach((childSnapshot) => {
            const article = {
              uuid: childSnapshot.key || '',
              ...childSnapshot.val()
            };
            
            // Solo gli articoli con status "accepted" o quelli senza status (retrocompatibilità)
            if (article.status === 'accepted' || !article.status) {
              articlesData.push(article);
            }
          })
          
          // Ordiniamo gli articoli lato client
          articlesData.sort((a, b) => 
            new Date(b.creazione).getTime() - new Date(a.creazione).getTime()
          )
          
          setArticles(articlesData)
        }
      } catch (error) {
        console.error("Errore nel recupero degli articoli:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchArticles()
  }, [])

  useEffect(() => {
    // Leggi il tag dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    const tagFromUrl = urlParams.get('tag');
    
    if (tagFromUrl) {
      setSelectedTags([tagFromUrl]);
    }
  }, []);

  // Aggiungi una funzione per verificare e pubblicare gli articoli programmati
  useEffect(() => {
    const checkScheduledArticles = async () => {
      try {
        const articlesRef = ref(db, 'articoli');
        const snapshot = await get(articlesRef);
        
        if (snapshot.exists()) {
          const now = new Date();
          const updates: Record<string, unknown> = {};
          let hasUpdates = false;
          
          snapshot.forEach((childSnapshot) => {
            const article = childSnapshot.val();
            const articleId = childSnapshot.key;
            
            // Verifica se è un articolo programmato e se la data di pubblicazione è stata raggiunta
            if (article.status === 'scheduled' && article.scheduleDate) {
              const scheduleDate = new Date(article.scheduleDate);
              
              if (scheduleDate <= now) {
                // La data di pubblicazione è stata raggiunta, aggiorna lo stato
                updates[`${articleId}/status`] = 'accepted';
                updates[`${articleId}/scheduleDate`] = null; // Rimuovi la data di programmazione
                hasUpdates = true;
              }
            }
          });
          
          // Aggiorna il database solo se ci sono modifiche
          if (hasUpdates) {
            await update(ref(db), { 'articoli': updates });
            console.log('Articoli programmati aggiornati con successo');
            
            // Aggiorna la lista degli articoli dopo l'aggiornamento
            window.location.reload(); // Ricarica la pagina per vedere gli articoli aggiornati
          }
        }
      } catch (error) {
        console.error('Errore durante la verifica degli articoli programmati:', error);
      }
    };
    
    // Esegui la verifica al caricamento della pagina
    checkScheduledArticles();
  }, []); // Esegui solo al montaggio del componente

  // Funzione per estrarre un excerpt dal contenuto
  const getExcerpt = (content: string, maxLength: number = 180) => {
    if (typeof document === 'undefined') return content.substring(0, maxLength) + '...'
    
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content
    const textContent = tempDiv.textContent || tempDiv.innerText || ''
    
    if (textContent.length <= maxLength) return textContent
    return textContent.substring(0, maxLength) + '...'
  }

  // Format the time difference
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    const diffWeeks = Math.floor(diffDays / 7)
    const diffMonths = Math.floor(diffDays / 30)
    const diffYears = Math.floor(diffDays / 365)
    
    if (diffYears > 0) {
      return `${diffYears} ${diffYears === 1 ? 'anno' : 'anni'} fa`
    } else if (diffMonths > 0) {
      return `${diffMonths} ${diffMonths === 1 ? 'mese' : 'mesi'} fa`
    } else if (diffWeeks > 0) {
      return `${diffWeeks} ${diffWeeks === 1 ? 'settimana' : 'settimane'} fa`
    } else if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'} fa`
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? 'ora' : 'ore'} fa`
    } else if (diffMins > 0) {
      return `${diffMins} ${diffMins === 1 ? 'minuto' : 'minuti'} fa`
    } else {
      return 'adesso'
    }
  }

  // Check if article is new (less than 24 hours)
  const isNewArticle = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours < 24;
  };

  // Funzione per gestire il toggle dei tag
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  // Funzione per filtrare gli articoli in base alla ricerca
  const filterBySearch = (articles: ArticleData[]) => {
    if (!searchQuery) return articles;
    
    const query = searchQuery.toLowerCase();
    return articles.filter(article => 
      article.titolo.toLowerCase().includes(query) ||
      article.contenuto.toLowerCase().includes(query) ||
      article.autore.toLowerCase().includes(query)
    );
  };

  // Funzione per ordinare gli articoli
  const sortArticles = (articles: ArticleData[]) => {
    return [...articles].sort((a, b) => {
      switch (sortBy) {
        case 'upvote':
          return (b.upvote || 0) - (a.upvote || 0);
        case 'view':
          return (b.view || 0) - (a.view || 0);
        case 'shared':
          return (b.shared || 0) - (a.shared || 0);
        default:
          // Per la data, usa la direzione di ordinamento
          const dateA = new Date(a.creazione).getTime();
          const dateB = new Date(b.creazione).getTime();
          return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
      }
    });
  };

  // Aggiungi questi stati
  const [authors, setAuthors] = useState<AuthorWithCount[]>([])
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])

  // Aggiorna la funzione fetchAuthors per contare gli articoli per ciascun autore
  useEffect(() => {
    const fetchAuthors = async () => {
      try {
        // Prima ottieni gli articoli per contare quelli per autore
        const articlesRef = ref(db, 'articoli')
        const articlesSnapshot = await get(articlesRef)
        
        // Contatore per gli articoli per autore
        const authorCounts: Record<string, number> = {};
        
        if (articlesSnapshot.exists()) {
          articlesSnapshot.forEach((childSnapshot) => {
            const article = childSnapshot.val();
            // Conta solo articoli con status 'accepted' o senza status
            if (article.status === 'accepted' || !article.status) {
              const authorName = article.autore;
              if (authorName) {
                authorCounts[authorName] = (authorCounts[authorName] || 0) + 1;
              }
            }
          });
        }
        
        // Poi ottieni l'elenco degli autori
        const authorsRef = ref(db, 'autori')
        const authorsSnapshot = await get(authorsRef)
        
        if (authorsSnapshot.exists()) {
          const authorsData: AuthorWithCount[] = []
          authorsSnapshot.forEach((childSnapshot) => {
            if (childSnapshot.val().name) {
              const authorName = childSnapshot.val().name;
              // Includi solo autori che hanno almeno un articolo accettato
              const articleCount = authorCounts[authorName] || 0;
              if (articleCount > 0) {
                authorsData.push({
                  name: authorName,
                  count: articleCount
                });
              }
            }
          })
          
          // Ordina alfabeticamente, tenendo conto dell'italiano e ignorando maiuscole/minuscole
          const sortedAuthors = authorsData.sort((a, b) => 
            a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
          );
          
          setAuthors(sortedAuthors)
        }
      } catch (error) {
        console.error("Errore nel recupero degli autori:", error)
      }
    }

    fetchAuthors()
  }, [])

  // Modifica la funzione toggle per selezionare un solo autore alla volta
  const toggleAuthor = (authorName: string) => {
    if (selectedAuthors.includes(authorName)) {
      // Se l'autore è già selezionato, deselezionalo
      setSelectedAuthors([]);
    } else {
      // Altrimenti seleziona solo questo autore
      setSelectedAuthors([authorName]);
    }
  }

  // Modifica l'useEffect esistente per il filtraggio per includere anche gli autori
  useEffect(() => {
    let result = articles;
    
    // Applica i filtri per tag
    if (selectedTags.length > 0) {
      result = result.filter(article => {
        const articleTags = article.tag?.split(',').map(tag => tag.trim().toUpperCase()) || [];
        return selectedTags.every(selectedTag => articleTags.includes(selectedTag));
      });
    }
    
    // Applica i filtri per autori
    if (selectedAuthors.length > 0) {
      result = result.filter(article => 
        selectedAuthors.includes(article.autore)
      );
    }
    
    // Applica il filtro di ricerca
    result = filterBySearch(result);
    
    // Ordina gli articoli
    result = sortArticles(result);
    
    setFilteredArticles(result);
  }, [selectedTags, selectedAuthors, articles, searchQuery, sortBy, sortDirection]);

  const handleArticleClick = async (articleId: string) => {
    try {
      const articleRef = ref(db, `articoli/${articleId}`);
      await update(articleRef, {
        view: increment(1)
      });
    } catch (error) {
      console.error("Errore nell'incremento delle visualizzazioni:", error);
    }
  };

  // Aggiungi uno useEffect per applicare gli stili CSS direttamente
  useEffect(() => {
    // Applica gli stili per le scrollbar personalizzate
    const style = document.createElement('style');
    style.textContent = `
      .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 10px;
      }
      
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      
      /* Firefox */
      .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
      }
    `;
    document.head.appendChild(style);
    
    // Pulizia quando il componente viene smontato
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Aggiungi questo stato per controllare la visibilità dei filtri
  const [showFilters, setShowFilters] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800 overflow-x-hidden">
      {/* Elementi decorativi di sfondo con animazione */}
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
      
      <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* Header con navigazione e link ai preferiti */}
        <div className="flex justify-between items-center mb-8">
          <motion.div
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Link 
              href="/"
              className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors duration-300"
            >
              <FiArrowLeft className="mr-2 h-4 w-4" />
              Torna alla home
            </Link>
          </motion.div>

          {/* Link Articoli Preferiti - visibile solo se autenticato */}
          {user && (
            <motion.div
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Link
                href="/favorites"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-full transition-all duration-300"
              >
                <FiHeart className="h-4 w-4" />
                <span>Articoli Preferiti</span>
              </Link>
            </motion.div>
          )}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 sm:mb-12"
        >
          <motion.div
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
              className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-50 mb-2"
            >
              Tutti gli Articoli
            </motion.h1>
          </motion.div>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-sm text-zinc-500 dark:text-zinc-400 mb-4"
          >
            {loading ? (
              <span className="animate-pulse">Caricamento articoli...</span>
            ) : (
              <span>
                Articoli totali{' '}
                <AnimatedCounter value={filteredArticles.length} />{' '}
                • Mostrati{' '}
                <AnimatedCounter value={displayedArticles.length} />
                {(selectedTags.length > 0 || selectedAuthors.length > 0 || searchQuery) && (
                  <>
                    {selectedTags.length > 0 && (
                      <span className="text-amber-500"> • Filtrati per tag</span>
                    )}
                    {selectedAuthors.length > 0 && (
                      <span className="text-blue-500"> • Filtrato per autore</span>
                    )}
                    {searchQuery && (
                      <span className="text-amber-500"> • Ricerca attiva</span>
                    )}
                  </>
                )}
              </span>
            )}
          </motion.p>
          
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "4rem" }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="h-[1px] bg-zinc-800 dark:bg-zinc-200" 
          />
        </motion.div>

        {/* Barra di ricerca con animazione */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mb-8 space-y-4"
        >
          {/* Barra di ricerca */}
          <div className="relative max-w-xl mx-auto">
            <motion.input
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per titolo, contenuto o autore..."
              className="w-full p-4 pl-12 bg-white/10 dark:bg-zinc-800/30 border border-white/20 rounded-xl focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
            />
            <motion.svg
              initial={{ rotate: -20, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </motion.svg>
          </div>

          {/* Filtri di ordinamento */}
          <div className="flex flex-wrap justify-center gap-3 px-4">
            {[
              { id: 'date', icon: sortDirection === 'desc' ? LuClockArrowUp : LuClockArrowDown, text: sortDirection === 'desc' ? 'Più recenti' : 'Meno recenti' },
              { id: 'upvote', icon: FiHeart, text: 'Più piaciuti' },
              { id: 'view', icon: FiEye, text: 'Più visti' },
              { id: 'shared', icon: FiShare2, text: 'Più condivisi' }
            ].map((btn, index) => (
              <motion.button
                key={btn.id}
                onClick={() => {
                  if (sortBy === btn.id && btn.id === 'date') {
                    // Se è già selezionato 'date', inverti la direzione
                    setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                  } else {
                    // Altrimenti, imposta il nuovo sortBy e la direzione predefinita a 'desc'
                    setSortBy(btn.id as 'date' | 'upvote' | 'view' | 'shared');
                    setSortDirection('desc');
                  }
                }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.8 + (index * 0.1) }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={btn.text}
                title={btn.text}
                className={`
                  flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl
                  font-medium text-sm transition-all duration-300 cursor-pointer
                  transform hover:scale-105 active:scale-100 h-10 sm:h-auto justify-center
                  ${sortBy === btn.id
                    ? `bg-gradient-to-r ${
                        btn.id === 'date' ? 'from-amber-500 to-amber-600 shadow-amber-500/25' :
                        btn.id === 'upvote' ? 'from-rose-500 to-rose-600 shadow-rose-500/25' :
                        btn.id === 'view' ? 'from-blue-500 to-blue-600 shadow-blue-500/25' :
                        'from-emerald-500 to-emerald-600 shadow-emerald-500/25'
                      } text-white shadow-lg`
                    : 'bg-white/10 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-800/50'
                  }
                `}
              >
                <btn.icon className={`h-4 w-4 ${sortBy === btn.id ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{btn.text}</span>
              </motion.button>
            ))}
          </div>

          {/* Pulsante mostra/nascondi filtri e reset filtri */}
          <div className="flex justify-center mt-4">
            <motion.button
              onClick={() => setShowFilters(!showFilters)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label={showFilters ? "Nascondi filtri avanzati" : "Mostra filtri avanzati"}
              title={showFilters ? "Nascondi filtri avanzati" : "Mostra filtri avanzati"}
              className={`
                flex items-center gap-2 px-4 sm:px-5 py-2.5 ${(selectedTags.length > 0 || selectedAuthors.length > 0 || searchQuery) ? 'rounded-l-xl' : 'rounded-xl'} h-10 sm:h-auto justify-center
                font-medium text-sm transition-all duration-300 cursor-pointer
                transform hover:scale-105 active:scale-100
                ${showFilters
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-white/10 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-800/50'
                }
              `}
            >
              {showFilters ? (
                <>
                  <FiFilter className="h-4 w-4" />
                  <span className="hidden sm:inline">Nascondi filtri avanzati</span>
                </>
              ) : (
                <>
                  <FiFilter className="h-4 w-4" />
                  <span className="hidden sm:inline">Mostra filtri avanzati</span>
                </>
              )}
            </motion.button>
            
            <AnimatePresence mode="wait">
              {(selectedTags.length > 0 || selectedAuthors.length > 0 || searchQuery) ? (
                <motion.button
                  key="reset-filters"
                  onClick={() => {
                    setSelectedTags([]);
                    setSelectedAuthors([]);
                    setSearchQuery("");
                    if (showFilters) {
                      setShowFilters(false);
                    }
                  }}
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ 
                    opacity: 1, 
                    width: "auto",
                    transition: { 
                      opacity: { duration: 0.3, ease: "easeInOut" },
                      width: { duration: 0.3, ease: "easeInOut" }
                    }
                  }}
                  exit={{ 
                    opacity: 0, 
                    width: 0,
                    transition: { 
                      opacity: { duration: 0.2, ease: "easeInOut" },
                      width: { duration: 0.2, ease: "easeInOut", delay: 0.1 }
                    }
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Rimuovi tutti i filtri"
                  title="Rimuovi tutti i filtri"
                  className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-r-xl h-10 sm:h-auto justify-center
                    font-medium text-sm transition-colors duration-300 cursor-pointer
                    whitespace-nowrap overflow-hidden
                    bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25
                    border-l border-white/10 dark:border-zinc-700/30"
                >
                  <LuFilterX className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline flex-shrink-0">Rimuovi tutti i filtri</span>
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Topics Navigation con layout a colonne - condizionale in base allo stato showFilters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              key="filters"
              initial={{ opacity: 0, height: 0 }}
              animate={{ 
                opacity: 1, 
                height: 'auto',
                transition: { duration: 0.4, ease: "easeOut" }
              }}
              exit={{ 
                opacity: 0, 
                height: 0,
                transition: { duration: 0.3, ease: "easeIn" }
              }}
              className="mb-8 overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-7xl mx-auto">
                {/* Colonna per i tag */}
                <div className="rounded-2xl bg-white/5 dark:bg-zinc-800/20 backdrop-blur-lg border border-white/10 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-zinc-800 dark:text-zinc-200 font-medium flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Filtra per categorie {selectedTags.length > 0 && `(${selectedTags.length})`}
                    </h3>
                    {selectedTags.length > 0 && (
                      <LuFilterX 
                        className="h-5 w-5 text-amber-500 cursor-pointer hover:text-amber-600 transition-colors duration-200" 
                        onClick={() => setSelectedTags([])}
                        title="Rimuovi filtri categoria"
                      />
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {topics.map((topic, index) => (
                      <motion.button
                        key={topic}
                        onClick={() => toggleTag(topic)}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 + (index * 0.02) }}
                        whileHover={{ 
                          scale: 1.03, 
                          y: -1,
                          transition: { duration: 0.2 }
                        }}
                        whileTap={{ 
                          scale: 0.97,
                          transition: { duration: 0.1 }
                        }}
                        aria-label={topic}
                        title={topic}
                        className={`
                          flex items-center px-2 sm:px-3 py-1.5 text-xs font-medium
                          rounded-xl transition-all duration-300 cursor-pointer
                          ${selectedTags.includes(topic)
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25'
                            : 'bg-white/10 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-700/70'
                          }
                          border border-white/10
                        `}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>{topic}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
                
                {/* Colonna per gli autori con raggruppamento per iniziale */}
                <div className="rounded-2xl bg-white/5 dark:bg-zinc-800/20 backdrop-blur-lg border border-white/10 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-zinc-800 dark:text-zinc-200 font-medium flex items-center gap-2">
                      <FiUser className="h-5 w-5 text-blue-500" />
                      Filtra per autore {selectedAuthors.length > 0 && `(${selectedAuthors[0]})`}
                    </h3>
                    {selectedAuthors.length > 0 && (
                      <LuFilterX 
                        className="h-5 w-5 text-blue-500 cursor-pointer hover:text-blue-600 transition-colors duration-200" 
                        onClick={() => setSelectedAuthors([])}
                        title="Rimuovi filtro autore"
                      />
                    )}
                  </div>
                  
                  <div className="max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                    {authors.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {authors.map((author, index) => (
                          <motion.button
                            key={author.name}
                            onClick={() => toggleAuthor(author.name)}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.1 + (index * 0.02) }}
                            whileHover={{ 
                              scale: 1.03, 
                              y: -1,
                              transition: { duration: 0.2 }
                            }}
                            whileTap={{ 
                              scale: 0.97,
                              transition: { duration: 0.1 }
                            }}
                            aria-label={author.name}
                            title={`${author.name} (${author.count} articoli)`}
                            className={`
                              flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-medium
                              rounded-xl transition-all duration-300 cursor-pointer
                              ${selectedAuthors.includes(author.name)
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25'
                                : 'bg-white/10 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-700/70'
                              }
                              border border-white/10
                            `}
                          >
                            <FiUser className="h-3 w-3 mr-1" />
                            <span>{author.name}</span>
                            {author.count > 0 && (
                              <span className="ml-1 text-amber-500 font-medium">
                                {author.count}
                              </span>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-500 dark:text-zinc-400 p-2">
                        Nessun autore disponibile
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          // Stato di caricamento animato con skeleton per articoli
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-6 md:gap-8"
          >
            {[...Array(5)].map((_, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="bg-white/5 dark:bg-zinc-800/20 rounded-2xl overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Skeleton per l'immagine */}
                  <div className="relative sm:w-[240px] h-[200px] sm:h-auto flex-shrink-0 bg-zinc-200/20 dark:bg-zinc-700/20 animate-pulse"></div>
                  
                  {/* Skeleton per il contenuto */}
                  <div className="flex flex-col flex-1 p-4 sm:p-6 space-y-4">
                    {/* Skeleton per i tag */}
                    <div className="flex gap-2">
                      <div className="h-5 w-16 bg-zinc-200/30 dark:bg-zinc-700/30 rounded-full animate-pulse"></div>
                      <div className="h-5 w-20 bg-zinc-200/30 dark:bg-zinc-700/30 rounded-full animate-pulse"></div>
                    </div>
                    
                    {/* Skeleton per il titolo */}
                    <div className="h-8 bg-zinc-200/30 dark:bg-zinc-700/30 rounded-lg w-3/4 animate-pulse"></div>
                    
                    {/* Skeleton per l'excerpt */}
                    <div className="space-y-2">
                      <div className="h-4 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full w-full animate-pulse"></div>
                      <div className="h-4 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full w-full animate-pulse"></div>
                      <div className="h-4 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full w-2/3 animate-pulse"></div>
                    </div>
                    
                    {/* Skeleton per il footer */}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="h-4 w-24 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full animate-pulse"></div>
                        <div className="h-4 w-20 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full animate-pulse"></div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="h-4 w-12 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full animate-pulse"></div>
                        <div className="h-4 w-12 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full animate-pulse"></div>
                        <div className="h-4 w-12 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : displayedArticles.length > 0 ? (
          <div className="grid gap-6 md:gap-8">
            {displayedArticles.map((article, index) => (
              <motion.div
                key={article.uuid}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + (index * 0.1) }}
                whileHover={{ y: -5 }}
                layout
              >
                <Link 
                  href={`/article/${article.uuid}`}
                  onClick={() => handleArticleClick(article.uuid)}
                  className="block group bg-white/5 dark:bg-zinc-800/20 hover:bg-white/10 dark:hover:bg-zinc-800/30 backdrop-blur-lg border border-white/10 dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-300"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Immagine (visibile solo su desktop) */}
                    <div className="relative sm:w-[240px] h-[200px] sm:h-auto flex-shrink-0 overflow-hidden">
                      <Image
                        src={article.immagine}
                        alt={article.titolo}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/placeholder-image.jpg';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>

                    {/* Contenuto */}
                    <div className="flex flex-col flex-1 p-4 sm:p-6">
                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {article.tag?.split(',').map((tag, idx) => (
                          <motion.span 
                            key={idx}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: 0.3 + (index * 0.1) + (idx * 0.05) }}
                            className="px-2.5 py-1 text-[10px] font-medium bg-amber-500/90 text-white rounded-full"
                          >
                            {tag.trim() || 'GENERALE'}
                          </motion.span>
                        ))}
                        
                        {/* "NEW" tag if article is recent */}
                        {isNewArticle(article.creazione) && (
                          <motion.span 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, delay: 0.3 + (index * 0.1) }}
                            className="px-2.5 py-1 text-[10px] font-medium bg-green-500 text-white rounded-full"
                          >
                            NUOVO
                          </motion.span>
                        )}
                      </div>

                      {/* Titolo */}
                      <h2 className="font-serif text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2 group-hover:text-amber-500 transition-colors duration-300">
                        {article.titolo}
                      </h2>

                      {/* Excerpt with optimized font for reading */}
                      <p className="font-['Inter'] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2 sm:line-clamp-3">
                        {getExcerpt(article.contenuto)}
                      </p>

                      {/* Footer */}
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                          <span className="font-medium">{article.autore}</span>
                          <span className="flex items-center">
                            <FiClock className="mr-1 h-4 w-4" />
                            {getTimeAgo(article.creazione)}
                          </span>
                        </div>

                        {/* Metrics */}
                        <div className="flex items-center gap-4 text-sm">
                          <motion.span 
                            whileHover={{ scale: 1.2 }}
                            className="flex items-center text-rose-500"
                          >
                            <FiHeart className="mr-1 h-4 w-4" />
                            {article.upvote || 0}
                          </motion.span>
                          <motion.span 
                            whileHover={{ scale: 1.2 }}
                            className="flex items-center text-emerald-500"
                          >
                            <FiEye className="mr-1 h-4 w-4" />
                            {article.view || 0}
                          </motion.span>
                          <motion.span 
                            whileHover={{ scale: 1.2 }}
                            className="flex items-center text-blue-500"
                          >
                            <FiShare2 className="mr-1 h-4 w-4" />
                            {article.shared || 0}
                          </motion.span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            
            {/* Pulsante "Carica altri articoli" */}
            {displayLimit < filteredArticles.length && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={loadMoreArticles}
                className="cursor-pointer mx-auto mt-8 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl shadow-lg shadow-amber-500/25 transition-all duration-300 flex items-center gap-2 group hover:shadow-xl"
              >
                <span>Carica altri articoli</span>
                <svg 
                  className="w-5 h-5 transform transition-transform duration-300 group-hover:translate-y-1" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M19 14l-7 7m0 0l-7-7m7 7V3" 
                  />
                </svg>
                <span className="text-sm opacity-80">
                  ({Math.min(5, filteredArticles.length - displayLimit)} di {filteredArticles.length - displayLimit} rimanenti)
                </span>
              </motion.button>
            )}
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.5 }}
            className="flex flex-col items-center justify-center py-16 px-4 text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.7, type: "spring" }}
              className="h-24 w-24 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full mb-6"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-12 w-12 text-zinc-500 dark:text-zinc-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 10.5L14.5 15.5M14.5 10.5L9.5 15.5M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20M6.5 2H17.5L22 6.5V17.5C22 18.163 21.7366 18.7989 21.2678 19.2678C20.7989 19.7366 20.163 20 19.5 20H6.5C5.83696 20 5.20107 19.7366 4.73223 19.2678C4.26339 18.7989 4 18.163 4 17.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" />
              </svg>
            </motion.div>
            <motion.h3 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.9 }}
              className="text-xl font-serif font-bold text-zinc-800 dark:text-zinc-200 mb-2"
            >
              Nessun articolo trovato
            </motion.h3>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 2.1 }}
              className="text-zinc-600 dark:text-zinc-400 max-w-md"
            >
              {selectedTags.length > 0 || searchQuery
                ? "Non abbiamo trovato articoli che corrispondono ai tuoi criteri di ricerca."
                : "Non ci sono ancora articoli disponibili."}
            </motion.p>
          </motion.div>
        )}
      </div>
    </main>
  )
} 