"use client"

import { useState, useEffect } from "react"
import { ref, get, update, increment } from "firebase/database"
import { db, auth } from "../firebase"
import { FiHeart, FiShare2, FiEye, FiClock, FiArrowLeft } from "react-icons/fi"
import Link from "next/link"
import Image from "next/image"
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
  likes?: string[]
  status?: string
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
            // Filtra solo gli articoli che:
            // 1. L'utente ha messo like
            // 2. Hanno status 'accepted' o non hanno status (retrocompatibilità)
            if (article.likes?.includes(user.uid) && 
                (article.status === 'accepted' || !article.status)) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center text-zinc-600 dark:text-zinc-400"
        >
          <div className="w-16 h-16 border-t-4 border-amber-500 rounded-full animate-spin mb-4"></div>
          Caricamento...
        </motion.div>
      </div>
    )
  }

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
          className="absolute -bottom-[40%] -left-[30%] h-[100vh] w-[100vh] rounded-full bg-gradient-to-tr from-rose-500/20 to-pink-500/10 blur-3xl dark:from-rose-500/10 dark:to-pink-500/5"
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
            I tuoi Articoli Preferiti
          </motion.h1>
          
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "4rem" }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="h-[1px] bg-zinc-800 dark:bg-zinc-200" 
          />
        </motion.div>

        {articles.length > 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="grid gap-6 md:gap-8"
          >
            {articles.map((article, index) => (
              <motion.div
                key={article.uuid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.6, 
                  delay: 0.2 + index * 0.1,
                  ease: "easeOut" 
                }}
                whileHover={{ scale: 1.02 }}
                className="overflow-hidden"
              >
                <Link 
                  href={`/article/${article.uuid}`}
                  onClick={() => handleArticleClick(article.uuid)}
                  className="block group bg-white/5 dark:bg-zinc-800/20 hover:bg-white/10 dark:hover:bg-zinc-800/30 backdrop-blur-lg border border-white/10 dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-300"
                >
                  <div className="flex flex-col sm:flex-row">
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

                    <div className="flex flex-col flex-1 p-4 sm:p-6">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {article.tag?.split(',').map((tag, idx) => (
                          <motion.span 
                            key={idx}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ 
                              duration: 0.3, 
                              delay: 0.4 + (index * 0.1) + (idx * 0.05) 
                            }}
                            className="px-2.5 py-1 text-[10px] font-medium bg-amber-500/90 text-white rounded-full"
                          >
                            {tag.trim() || 'GENERALE'}
                          </motion.span>
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
                          <motion.span 
                            whileHover={{ scale: 1.2 }}
                            className="flex items-center text-rose-500"
                          >
                            <FiHeart className="mr-1 h-4 w-4 fill-current" />
                            {article.upvote || 0}
                          </motion.span>
                          <motion.span 
                            whileHover={{ scale: 1.2 }}
                            className="flex items-center text-blue-500"
                          >
                            <FiEye className="mr-1 h-4 w-4" />
                            {article.view || 0}
                          </motion.span>
                          <motion.span 
                            whileHover={{ scale: 1.2 }}
                            className="flex items-center text-emerald-500"
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
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-center py-12 bg-white/5 dark:bg-zinc-800/20 backdrop-blur-md rounded-2xl border border-white/10"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <FiHeart className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4" />
            </motion.div>
            <motion.p 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 1 }}
              className="text-zinc-600 dark:text-zinc-400"
            >
              Non hai ancora aggiunto articoli ai preferiti.
            </motion.p>
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="mt-6"
            >
              <Link 
                href="/articles"
                className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl hover:opacity-90 transition-all duration-300"
              >
                <span>Sfoglia gli articoli</span>
              </Link>
            </motion.div>
          </motion.div>
        )}
      </div>
    </main>
  )
} 