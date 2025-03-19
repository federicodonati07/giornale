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
  additionalLinks?: Array<{ url: string, label: string }>
  isPrivate: boolean
  notes?: Array<{
    id: string;
    text: string;
    note: string;
    startOffset: number;
    endOffset: number;
  }>
  secondaryNotes?: Array<{ id: string, content: string }>
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
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center">
        <div className="animate-pulse text-zinc-400">
          Caricamento...
        </div>
      </div>
    )
  }

  // Verifica se l'articolo è privato e l'utente non è autenticato
  if (article?.isPrivate && !user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          {/* Header con navigazione */}
          <div className="mb-8">
            <Link 
              href="/articles"
              className="inline-flex items-center text-sm text-zinc-400 hover:text-amber-500 transition-colors duration-300 mb-4"
            >
              <FiArrowLeft className="mr-2 h-4 w-4" />
              Torna agli articoli
            </Link>
          </div>

          {/* Contenuto blurrato */}
          <div className="relative">
            {/* Mostra l'articolo blurrato */}
            <div className="blur-md opacity-50">
              <div className="relative w-full aspect-video max-w-4xl mx-auto mb-8 rounded-2xl overflow-hidden bg-zinc-700" />
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="h-12 bg-zinc-700 rounded-lg" />
                <div className="h-4 bg-zinc-700 rounded-lg w-3/4" />
                <div className="h-4 bg-zinc-700 rounded-lg" />
                <div className="h-4 bg-zinc-700 rounded-lg w-2/3" />
              </div>
            </div>

            {/* Overlay di accesso */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8 bg-zinc-800/30 rounded-2xl backdrop-blur-lg border border-zinc-700">
                <FiLock className="mx-auto h-12 w-12 text-amber-500 mb-4" />
                <h2 className="text-2xl font-bold text-zinc-50 mb-4">
                  Contenuto riservato
                </h2>
                <p className="text-zinc-400 mb-6">
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
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800 flex items-center justify-center">
        <div className="text-zinc-400">
          Articolo non trovato
        </div>
      </div>
    )
  }

  // Modifica la funzione che renderizza il contenuto per includere le note
  const renderContentWithNotes = (content: string, notes?: ArticleData['notes']) => {
    if (!notes || notes.length === 0) return content;
    
    const contentWithNotes = content;
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentWithNotes, 'text/html');

    notes.forEach(note => {
      const noteElements = doc.querySelectorAll(`[data-note-id="${note.id}"]`);
      noteElements.forEach(element => {
        const noteWrapper = document.createElement('span');
        noteWrapper.className = 'note-text';
        noteWrapper.innerHTML = `
          ${element.innerHTML}
          <svg class="note-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" 
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="note-tooltip">${note.note}</span>
        `;
        element.replaceWith(noteWrapper);
      });
    });

    return doc.body.innerHTML;
  };

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
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">Autore:</span>
                <span className="text-zinc-600 dark:text-zinc-400">{article.autore}</span>
              </div>
              {article.partecipanti && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">Partecipanti:</span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {Array.isArray(article.partecipanti) 
                      ? article.partecipanti.join(', ')
                      : article.partecipanti}
                  </span>
                </div>
              )}
              <span className="flex items-center text-zinc-600 dark:text-zinc-400">
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
          <span 
            className="text-lg leading-9 tracking-[0.04em] text-zinc-900 dark:text-zinc-300
              font-montserrat block space-y-6 [&>p]:mb-6 
              [&>p]:leading-relaxed [&>p]:tracking-wide
              [&>*]:tracking-wide [&>*]:leading-relaxed
              [&_.note-text]:relative
              [&_.note-text]:border-b
              [&_.note-text]:border-dashed
              [&_.note-text]:border-amber-500/50
              [&_.note-text]:cursor-help
              [&_.note-text]:inline-flex
              [&_.note-text]:items-center
              [&_.note-text]:gap-0.5
              [&_.note-text]:group
              [&_.note-icon]:text-amber-500/70
              [&_.note-icon]:h-3.5
              [&_.note-icon]:w-3.5
              [&_.note-icon]:inline
              [&_.note-tooltip]:invisible
              [&_.note-tooltip]:opacity-0
              [&_.note-tooltip]:absolute
              [&_.note-tooltip]:-top-2
              [&_.note-tooltip]:left-1/2
              [&_.note-tooltip]:-translate-x-1/2
              [&_.note-tooltip]:-translate-y-full
              [&_.note-tooltip]:px-3
              [&_.note-tooltip]:py-2
              [&_.note-tooltip]:rounded-lg
              [&_.note-tooltip]:bg-zinc-800
              [&_.note-tooltip]:text-zinc-100
              [&_.note-tooltip]:text-sm
              [&_.note-tooltip]:shadow-xl
              [&_.note-tooltip]:backdrop-blur-sm
              [&_.note-tooltip]:whitespace-normal
              [&_.note-tooltip]:max-w-xs
              [&_.note-tooltip]:z-50
              [&_.note-tooltip]:transition-all
              [&_.note-tooltip]:duration-200
              [&_.note-text:hover_.note-tooltip]:visible
              [&_.note-text:hover_.note-tooltip]:opacity-100
              [&_.note-text:hover_.note-tooltip]:translate-y-0"
            dangerouslySetInnerHTML={{ 
              __html: renderContentWithNotes(article.contenuto, article.notes) 
            }}
          />

          {/* Note secondarie */}
          {article.secondaryNotes && article.secondaryNotes.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6 mt-8">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">
                Note
              </h3>
              <div className="space-y-3">
                {article.secondaryNotes.map((note, index) => (
                  <div key={note.id} className="flex items-start gap-2 text-xs font-montserrat">
                    <span className="font-medium text-amber-600 dark:text-amber-400 flex-shrink-0">
                      [{index + 1}]
                    </span>
                    <p className="text-zinc-600 dark:text-zinc-400 tracking-wide leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link aggiuntivi con design minimal */}
          {article.additionalLinks && article.additionalLinks.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6 mt-8">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-4">
                Link correlati
              </h3>
              <div className="flex flex-wrap gap-3">
                {article.additionalLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-amber-500 hover:text-amber-600 
                      dark:text-amber-400 dark:hover:text-amber-300 transition-colors duration-200"
                  >
                    <span>{link.label}</span>
                    <svg 
                      className="h-3.5 w-3.5 opacity-70" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                      />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer con info e metriche ripetute */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50 block mb-1">Autore</span>
                  <span className="text-zinc-600 dark:text-zinc-400">{article.autore}</span>
                </div>
                
                {article.partecipanti && (
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50 block mb-1">Partecipanti</span>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {Array.isArray(article.partecipanti) 
                        ? article.partecipanti.join(', ')
                        : article.partecipanti}
                    </span>
                  </div>
                )}
                
                <span className="flex items-center text-zinc-600 dark:text-zinc-400">
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