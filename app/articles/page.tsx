"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ref, get} from "firebase/database"
import { db } from "../firebase"
import { FiHeart, FiShare2, FiEye, FiClock, FiArrowLeft } from "react-icons/fi"
import Link from "next/link"
import { motion } from "framer-motion"

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
        {/* Header con navigazione */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 sm:mb-12"
        >
          <motion.div
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Link 
              href="/"
              className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors duration-300 mb-4"
            >
              <FiArrowLeft className="mr-2 h-4 w-4" />
              Torna alla home
            </Link>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-50 mb-4"
          >
            Tutti gli Articoli
          </motion.h1>
          
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
              { id: 'date', icon: FiClock, text: 'Più recenti' },
              { id: 'upvote', icon: FiHeart, text: 'Più piaciuti' },
              { id: 'view', icon: FiEye, text: 'Più visti' },
              { id: 'shared', icon: FiShare2, text: 'Più condivisi' }
            ].map((btn, index) => (
              <motion.button
                key={btn.id}
                onClick={() => setSortBy(btn.id as 'date' | 'upvote' | 'view' | 'shared')}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.8 + (index * 0.1) }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  flex items-center gap-2 px-5 py-2.5 rounded-xl
                  font-medium text-sm transition-all duration-300 cursor-pointer
                  transform hover:scale-105 active:scale-100
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
                {btn.text}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Topics Navigation */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="mb-8"
        >
          <div className="flex flex-wrap justify-center gap-3 max-w-7xl mx-auto">
            {topics.map((topic, index) => (
              <motion.button
                key={topic}
                onClick={() => toggleTag(topic)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 1.3 + (index * 0.05) }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
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
              </motion.button>
            ))}
          </div>
          {selectedTags.length > 0 && (
            <motion.button
              onClick={() => setSelectedTags([])}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.8 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="mt-6 mx-auto block text-sm font-medium px-4 py-2 rounded-lg
                text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 
                transition-all duration-300 hover:scale-105 active:scale-100
                bg-white/5 dark:bg-zinc-800/30 hover:bg-white/10 dark:hover:bg-zinc-800/50"
            >
              Rimuovi filtri
            </motion.button>
          )}
        </motion.div>

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
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-4">
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
                          const target = e.target as HTMLImageElement
                          target.src = '/placeholder-image.jpg'
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
            
            {/* Pulsante "Mostra più articoli" */}
            {filteredArticles.length > 15 && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 2.2 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAllArticles(!showAllArticles)}
                className="mx-auto mt-8 px-6 py-3 bg-white/10 dark:bg-zinc-800/30 hover:bg-amber-500/10 rounded-xl transition-all duration-300 text-zinc-800 dark:text-zinc-200"
              >
                {showAllArticles ? 'Mostra meno articoli' : `Mostra altri ${filteredArticles.length - 15} articoli`}
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