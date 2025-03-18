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

export default function Articles() {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [filteredArticles, setFilteredArticles] = useState<ArticleData[]>([])

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const articlesRef = ref(db, 'articoli')
        const snapshot = await get(articlesRef)
        
        if (snapshot.exists()) {
          const articlesData: ArticleData[] = []
          
          snapshot.forEach((childSnapshot) => {
            articlesData.push({
              uuid: childSnapshot.key || '',
              ...childSnapshot.val()
            })
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

  // Filtra gli articoli quando cambiano i tag selezionati
  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredArticles(articles)
    } else {
      setFilteredArticles(articles.filter(article => 
        article.tag?.split(',').some(tag => 
          selectedTags.includes(tag.trim().toUpperCase())
        )
      ))
    }
  }, [selectedTags, articles])

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

        {/* Topics Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-7xl mx-auto">
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => toggleTag(topic)}
                className={`
                  px-4 py-2 text-xs sm:text-sm font-medium tracking-wider rounded-full
                  transition-all duration-300 ease-in-out cursor-pointer
                  ${selectedTags.includes(topic)
                    ? 'bg-amber-500 text-white shadow-lg scale-105'
                    : 'bg-white/10 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 hover:bg-amber-500/10 hover:text-amber-500 dark:hover:bg-amber-500/20'
                  }
                  border border-white/20 backdrop-blur-md
                `}
              >
                {topic}
              </button>
            ))}
          </div>
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="mt-4 mx-auto block text-sm text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors duration-300"
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
        ) : (
          <div className="grid gap-6 md:gap-8">
            {filteredArticles.length > 0 ? (
              filteredArticles.map((article) => (
                <article 
                  key={article.uuid}
                  className="group bg-white/5 dark:bg-zinc-800/20 hover:bg-white/10 dark:hover:bg-zinc-800/30 backdrop-blur-lg border border-white/10 dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
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
                </article>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Nessun articolo trovato per i tag selezionati.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
} 