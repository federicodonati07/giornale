"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ref, get} from "firebase/database"
import { db } from "../firebase"
import { FiHeart, FiShare2, FiEye, FiClock, FiArrowLeft } from "react-icons/fi"
import Link from "next/link"

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
  "ITALIA"
]

export default function Articles() {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filteredArticles, setFilteredArticles] = useState<ArticleData[]>([])
  
  // Aggiungi questi nuovi stati
  const [showAllArticles, setShowAllArticles] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<'date' | 'upvote' | 'view' | 'shared'>('date')

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

  // Aggiungi questo useEffect dopo la dichiarazione degli stati
  useEffect(() => {
    // Leggi il tag dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    const tagFromUrl = urlParams.get('tag');
    
    if (tagFromUrl) {
      setSelectedTags([tagFromUrl]);
    }
  }, []);

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
    
    if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'} fa`
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? 'ora' : 'ore'} fa`
    } else if (diffMins > 0) {
      return `${diffMins} ${diffMins === 1 ? 'minuto' : 'minuti'} fa`
    } else {
      return 'adesso'
    }
  }

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
          return new Date(b.creazione).getTime() - new Date(a.creazione).getTime();
      }
    });
  };

  // Modifica l'useEffect esistente per il filtraggio
  useEffect(() => {
    let result = articles;
    
    // Applica i filtri per tag
    if (selectedTags.length > 0) {
      result = result.filter(article => 
        article.tag?.split(',').some(tag => 
          selectedTags.includes(tag.trim().toUpperCase())
        )
      );
    }
    
    // Applica il filtro di ricerca
    result = filterBySearch(result);
    
    // Ordina gli articoli
    result = sortArticles(result);
    
    setFilteredArticles(result);
  }, [selectedTags, articles, searchQuery, sortBy]);

  // Calcola gli articoli da visualizzare
  const displayedArticles = showAllArticles 
    ? filteredArticles 
    : filteredArticles.slice(0, 15);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        {/* Header con navigazione */}
        <div className="mb-8 sm:mb-12">
          <Link 
            href="/"
            className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors duration-300 mb-4"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            Torna alla home
          </Link>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
            Tutti gli Articoli
          </h1>
          <div className="w-16 h-[1px] bg-zinc-800 dark:bg-zinc-200" />
        </div>

        {/* Aggiungi la barra di ricerca e i filtri di ordinamento */}
        <div className="mb-8 space-y-4">
          {/* Barra di ricerca */}
          <div className="relative max-w-xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per titolo, contenuto o autore..."
              className="w-full p-4 pl-12 bg-white/10 dark:bg-zinc-800/30 border border-white/20 rounded-xl focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filtri di ordinamento */}
          <div className="flex flex-wrap justify-center gap-3 px-4">
            <button
              onClick={() => setSortBy('date')}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl
                font-medium text-sm transition-all duration-300 cursor-pointer
                transform hover:scale-105 active:scale-100
                ${sortBy === 'date'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25'
                  : 'bg-white/10 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-800/50'
                }
              `}
            >
              <FiClock className={`h-4 w-4 ${sortBy === 'date' ? 'animate-pulse' : ''}`} />
              Più recenti
            </button>
            <button
              onClick={() => setSortBy('upvote')}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl
                font-medium text-sm transition-all duration-300 cursor-pointer
                transform hover:scale-105 active:scale-100
                ${sortBy === 'upvote'
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25'
                  : 'bg-white/10 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-800/50'
                }
              `}
            >
              <FiHeart className={`h-4 w-4 ${sortBy === 'upvote' ? 'animate-pulse' : ''}`} />
              Più piaciuti
            </button>
            <button
              onClick={() => setSortBy('view')}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl
                font-medium text-sm transition-all duration-300 cursor-pointer
                transform hover:scale-105 active:scale-100
                ${sortBy === 'view'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-white/10 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-800/50'
                }
              `}
            >
              <FiEye className={`h-4 w-4 ${sortBy === 'view' ? 'animate-pulse' : ''}`} />
              Più visti
            </button>
            <button
              onClick={() => setSortBy('shared')}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-xl
                font-medium text-sm transition-all duration-300 cursor-pointer
                transform hover:scale-105 active:scale-100
                ${sortBy === 'shared'
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-white/10 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-800/50'
                }
              `}
            >
              <FiShare2 className={`h-4 w-4 ${sortBy === 'shared' ? 'animate-pulse' : ''}`} />
              Più condivisi
            </button>
          </div>
        </div>

        {/* Topics Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-3 max-w-7xl mx-auto">
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => toggleTag(topic)}
                className={`
                  flex items-center px-5 py-2.5 text-xs sm:text-sm font-medium
                  rounded-xl transition-all duration-300 cursor-pointer
                  transform hover:scale-105 active:scale-100
                  ${selectedTags.includes(topic)
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25'
                    : 'bg-white/10 dark:bg-zinc-800/30 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-800/50'
                  }
                  backdrop-blur-md border border-white/10
                `}
              >
                {topic}
              </button>
            ))}
          </div>
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="mt-6 mx-auto block text-sm font-medium px-4 py-2 rounded-lg
                text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 
                transition-all duration-300 hover:scale-105 active:scale-100
                bg-white/5 dark:bg-zinc-800/30 hover:bg-white/10 dark:hover:bg-zinc-800/50"
            >
              Rimuovi filtri
            </button>
          )}
        </div>

        {loading ? (
          // Loading state
          <div className="grid gap-6 md:gap-8">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="animate-pulse bg-white/5 dark:bg-zinc-800/20 rounded-2xl p-4 sm:p-6">
                <div className="h-4 bg-zinc-200/30 dark:bg-zinc-700/30 rounded-full w-3/4 mb-4"></div>
                <div className="h-3 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full w-full mb-2"></div>
                <div className="h-3 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full w-5/6"></div>
              </div>
            ))}
          </div>
        ) : displayedArticles.length > 0 ? (
          <div className="grid gap-6 md:gap-8">
            {displayedArticles.map((article) => (
              <Link 
                href={`/article/${article.uuid}`}
                key={article.uuid}
                className="block group bg-white/5 dark:bg-zinc-800/20 hover:bg-white/10 dark:hover:bg-zinc-800/30 backdrop-blur-lg border border-white/10 dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Immagine (visibile solo su desktop) */}
                  <div className="relative sm:w-[240px] h-[200px] sm:h-auto flex-shrink-0">
                    <Image
                      src={article.immagine}
                      alt={article.titolo}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/placeholder-image.jpg'
                      }}
                    />
                  </div>

                  {/* Contenuto */}
                  <div className="flex flex-col flex-1 p-4 sm:p-6">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {article.tag?.split(',').map((tag, idx) => (
                        <span 
                          key={idx}
                          className="px-2.5 py-1 text-[10px] font-medium bg-amber-500/90 text-white rounded-full"
                        >
                          {tag.trim() || 'GENERALE'}
                        </span>
                      ))}
                    </div>

                    {/* Titolo */}
                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2 group-hover:text-amber-500 transition-colors duration-300">
                      {article.titolo}
                    </h2>

                    {/* Excerpt con font ottimizzato per la lettura */}
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

                      {/* Metriche */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center text-rose-500">
                          <FiHeart className="mr-1 h-4 w-4" />
                          {article.upvote || 0}
                        </span>
                        <span className="flex items-center text-emerald-500">
                          <FiEye className="mr-1 h-4 w-4" />
                          {article.view || 0}
                        </span>
                        <span className="flex items-center text-blue-500">
                          <FiShare2 className="mr-1 h-4 w-4" />
                          {article.shared || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            
            {/* Pulsante "Mostra più articoli" */}
            {filteredArticles.length > 15 && (
              <button
                onClick={() => setShowAllArticles(!showAllArticles)}
                className="mx-auto mt-8 px-6 py-3 bg-white/10 dark:bg-zinc-800/30 hover:bg-amber-500/10 rounded-xl transition-all duration-300 text-zinc-800 dark:text-zinc-200"
              >
                {showAllArticles ? 'Mostra meno articoli' : `Mostra altri ${filteredArticles.length - 15} articoli`}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="h-24 w-24 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full mb-6">
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
            </div>
            <h3 className="text-xl font-serif font-bold text-zinc-800 dark:text-zinc-200 mb-2">
              Nessun articolo trovato
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-md">
              {selectedTags.length > 0 || searchQuery
                ? "Non abbiamo trovato articoli che corrispondono ai tuoi criteri di ricerca."
                : "Non ci sono ancora articoli disponibili."}
            </p>
          </div>
        )}
      </div>
    </main>
  )
} 