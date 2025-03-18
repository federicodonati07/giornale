"use client"

import { useState, useEffect } from "react"
import { ref, get } from "firebase/database"
import { db, auth } from "../firebase"
import { FiHeart, FiShare2, FiEye, FiClock, FiArrowLeft } from "react-icons/fi"
import Link from "next/link"
import Image from "next/image"

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
  likes?: string[]
}

export default function FavoriteArticles() {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(auth.currentUser)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return
      
      try {
        const articlesRef = ref(db, 'articoli')
        const snapshot = await get(articlesRef)
        
        if (snapshot.exists()) {
          const articlesData: ArticleData[] = []
          
          snapshot.forEach((childSnapshot) => {
            const article = {
              uuid: childSnapshot.key || '',
              ...childSnapshot.val()
            }
            // Filtra solo gli articoli che l'utente ha messo like
            if (article.likes?.includes(user.uid)) {
              articlesData.push(article)
            }
          })
          
          // Ordina per data più recente
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

    fetchFavorites()
  }, [user])

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
        <div className="animate-pulse text-zinc-600 dark:text-zinc-400">
          Caricamento...
        </div>
      </div>
    )
  }

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
            I tuoi Articoli Preferiti
          </h1>
          <div className="w-16 h-[1px] bg-zinc-800 dark:bg-zinc-200" />
        </div>

        {articles.length > 0 ? (
          <div className="grid gap-6 md:gap-8">
            {articles.map((article) => (
              <Link 
                href={`/article/${article.uuid}`}
                key={article.uuid}
                className="block group bg-white/5 dark:bg-zinc-800/20 hover:bg-white/10 dark:hover:bg-zinc-800/30 backdrop-blur-lg border border-white/10 dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row">
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

                  <div className="flex flex-col flex-1 p-4 sm:p-6">
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

                    <h2 className="font-serif text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2 group-hover:text-amber-500 transition-colors duration-300">
                      {article.titolo}
                    </h2>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <span className="font-medium">{article.autore}</span>
                        <span className="flex items-center">
                          <FiClock className="mr-1 h-4 w-4" />
                          {getTimeAgo(article.creazione)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center text-rose-500">
                          <FiHeart className="mr-1 h-4 w-4 fill-current" />
                          {article.upvote || 0}
                        </span>
                        <span className="flex items-center text-blue-500">
                          <FiEye className="mr-1 h-4 w-4" />
                          {article.view || 0}
                        </span>
                        <span className="flex items-center text-emerald-500">
                          <FiShare2 className="mr-1 h-4 w-4" />
                          {article.shared || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400">
              Non hai ancora aggiunto articoli ai preferiti.
            </p>
          </div>
        )}
      </div>
    </main>
  )
} 