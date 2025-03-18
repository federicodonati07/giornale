"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { ref, get, update, increment } from "firebase/database"
import { db, auth } from "../../firebase"
import { FiHeart, FiShare2, FiEye, FiClock, FiArrowLeft, FiLock } from "react-icons/fi"
import Link from "next/link"
import { useParams } from "next/navigation"

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
  partecipanti?: string[]
  likes?: string[]
}

export default function Article() {
  const params = useParams()
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasLiked, setHasLiked] = useState(false)
  const [user, setUser] = useState(auth.currentUser)
  const [actionMessage, setActionMessage] = useState<string>('')
  const [hasViewed, setHasViewed] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const articleId = params.id as string
        const articleRef = ref(db, `articoli/${articleId}`)
        const snapshot = await get(articleRef)
        
        if (snapshot.exists()) {
          const articleData = {
            uuid: snapshot.key || '',
            ...snapshot.val()
          }
          setArticle(articleData)

          // Incrementa le visualizzazioni solo se l'utente è autenticato
          if (user) {
            await update(articleRef, {
              view: increment(1)
            })
          }
        }
      } catch (error) {
        console.error("Errore nel recupero dell'articolo:", error)
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchArticle()
    }
  }, [params.id, user])

  // Gestione visualizzazioni
  useEffect(() => {
    if (user && article && !hasViewed) {
      const incrementView = async () => {
        try {
          const articleRef = ref(db, `articoli/${params.id}`)
          await update(articleRef, {
            view: increment(1)
          })
          setHasViewed(true)
          setArticle(prev => prev ? {...prev, view: (prev.view || 0) + 1} : null)
        } catch (error) {
          console.error("Errore nell'incremento delle visualizzazioni:", error)
        }
      }
      incrementView()
    }
  }, [user, article, params.id, hasViewed])

  // Verifica se l'utente ha già messo like quando carica l'articolo
  useEffect(() => {
    if (user && article?.likes) {
      setHasLiked(article.likes.includes(user.uid))
    }
  }, [user, article])

  // Mostra messaggio temporaneo
  const showMessage = useCallback((message: string) => {
    setActionMessage(message)
    setTimeout(() => setActionMessage(''), 3000)
  }, [])

  const handleLike = async () => {
    if (!user) return
    
    try {
      const articleRef = ref(db, `articoli/${params.id}`)
      
      if (hasLiked) {
        // Rimuovi il like
        await update(articleRef, {
          upvote: increment(-1),
          likes: article?.likes?.filter(id => id !== user.uid) || []
        })
        setArticle(prev => prev ? {
          ...prev,
          upvote: (prev.upvote || 1) - 1,
          likes: prev.likes?.filter(id => id !== user.uid) || []
        } : null)
        showMessage('Like rimosso')
      } else {
        // Aggiungi il like
        const newLikes = article?.likes ? [...article.likes, user.uid] : [user.uid]
        await update(articleRef, {
          upvote: increment(1),
          likes: newLikes
        })
        setArticle(prev => prev ? {
          ...prev,
          upvote: (prev.upvote || 0) + 1,
          likes: newLikes
        } : null)
        showMessage('Grazie per il tuo like!')
      }
      setHasLiked(!hasLiked)
    } catch (error) {
      console.error("Errore nell'aggiornamento dei like:", error)
      showMessage("Errore nell'aggiornamento dei like")
    }
  }

  const handleShare = async () => {
    if (!user) return
    
    try {
      const url = window.location.href
      await navigator.clipboard.writeText(url)
      
      const articleRef = ref(db, `articoli/${params.id}`)
      await update(articleRef, {
        shared: increment(1)
      })
      
      setArticle(prev => prev ? {...prev, shared: (prev.shared || 0) + 1} : null)
      showMessage('Link copiato negli appunti!')
    } catch (error) {
      console.error("Errore nella condivisione:", error)
      showMessage("Errore nella condivisione")
    }
  }

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

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          {/* Header con navigazione */}
          <div className="mb-8">
            <Link 
              href="/articles"
              className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors duration-300 mb-4"
            >
              <FiArrowLeft className="mr-2 h-4 w-4" />
              Torna agli articoli
            </Link>
          </div>

          {/* Contenuto blurrato */}
          <div className="relative">
            {/* Mostra l'articolo blurrato */}
            <div className="blur-md opacity-50">
              <div className="relative w-full aspect-video max-w-4xl mx-auto mb-8 rounded-2xl overflow-hidden bg-zinc-300 dark:bg-zinc-700" />
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="h-12 bg-zinc-300 dark:bg-zinc-700 rounded-lg" />
                <div className="h-4 bg-zinc-300 dark:bg-zinc-700 rounded-lg w-3/4" />
                <div className="h-4 bg-zinc-300 dark:bg-zinc-700 rounded-lg" />
                <div className="h-4 bg-zinc-300 dark:bg-zinc-700 rounded-lg w-2/3" />
              </div>
            </div>

            {/* Overlay di accesso */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8 bg-white/10 dark:bg-zinc-800/30 rounded-2xl backdrop-blur-lg border border-white/20 dark:border-white/10">
                <FiLock className="mx-auto h-12 w-12 text-amber-500 mb-4" />
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                  Contenuto riservato
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                  Effettua l&apos;accesso per leggere l&apos;articolo
                </p>
                <Link
                  href="/access"
                  className="inline-flex items-center px-6 py-3 bg-amber-500 text-white rounded-full hover:bg-amber-600 transition-colors duration-300"
                >
                  Accedi
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center">
        <div className="text-zinc-600 dark:text-zinc-400">
          Articolo non trovato
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800">
      {/* Toast message */}
      {actionMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-zinc-800 dark:bg-zinc-700 text-white rounded-lg shadow-lg transition-opacity duration-300">
          {actionMessage}
        </div>
      )}

      <div className="container mx-auto px-4 py-8 sm:py-12">
        {/* Header con navigazione */}
        <div className="mb-8">
          <Link 
            href="/articles"
            className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors duration-300 mb-4"
          >
            <FiArrowLeft className="mr-2 h-4 w-4" />
            Torna agli articoli
          </Link>
        </div>

        {/* Immagine principale */}
        <div className="relative w-full aspect-video max-w-4xl mx-auto mb-8 rounded-2xl overflow-hidden">
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

        {/* Contenuto articolo */}
        <article className="max-w-4xl mx-auto">
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 text-center">
            {article.titolo}
          </h1>

          {/* Info e metriche */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 text-sm">
            <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400">
              <span className="font-medium">di {article.autore}</span>
              <span className="flex items-center">
                <FiClock className="mr-1 h-4 w-4" />
                {getTimeAgo(article.creazione)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={handleLike}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all duration-300 cursor-pointer
                  ${hasLiked 
                    ? 'bg-rose-500 text-white' 
                    : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'
                  }`}
              >
                <FiHeart className={`h-4 w-4 ${hasLiked ? 'fill-current' : ''}`} />
                {article.upvote || 0}
              </button>
              <span className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-full">
                <FiEye className="h-4 w-4" />
                {article.view || 0}
              </span>
              <button 
                onClick={handleShare}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full hover:bg-emerald-500 hover:text-white transition-all duration-300 cursor-pointer"
              >
                <FiShare2 className="h-4 w-4" />
                {article.shared || 0}
              </button>
            </div>
          </div>

          {/* Contenuto */}
          <div 
            className="prose prose-zinc dark:prose-invert max-w-none mb-12"
            dangerouslySetInnerHTML={{ __html: article.contenuto }}
          />

          {/* Footer con info e metriche ripetute */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex flex-col gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Autore</span>
                <span className="text-zinc-600 dark:text-zinc-400">{article.autore}</span>
                {article.partecipanti && Array.isArray(article.partecipanti) && article.partecipanti.length > 0 && (
                  <>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50 mt-2">Partecipanti</span>
                    <div className="flex flex-wrap gap-2">
                      {article.partecipanti.map((partecipante, idx) => (
                        <span 
                          key={idx}
                          className="text-zinc-600 dark:text-zinc-400"
                        >
                          {partecipante}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <span className="flex items-center text-zinc-600 dark:text-zinc-400 mt-2">
                  <FiClock className="mr-1 h-4 w-4" />
                  {getTimeAgo(article.creazione)}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <button 
                  onClick={handleLike}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all duration-300 cursor-pointer
                    ${hasLiked 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'
                    }`}
                >
                  <FiHeart className={`h-4 w-4 ${hasLiked ? 'fill-current' : ''}`} />
                  {article.upvote || 0}
                </button>
                <span className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-full">
                  <FiEye className="h-4 w-4" />
                  {article.view || 0}
                </span>
                <button 
                  onClick={handleShare}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full hover:bg-emerald-500 hover:text-white transition-all duration-300 cursor-pointer"
                >
                  <FiShare2 className="h-4 w-4" />
                  {article.shared || 0}
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </main>
  )
} 