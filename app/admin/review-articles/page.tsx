"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { FiArrowLeft, FiCheck, FiX, FiAlertCircle, FiEye, FiHeart, FiShare2, FiMaximize2, FiMinimize2 } from "react-icons/fi"
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage"
import { ref, get, remove, update } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth, db, app } from "../../firebase"

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
  partecipanti?: string
  isPrivate: boolean
  status: string // 'revision', 'accepted', 'rejected'
  additionalLinks?: { label: string; url: string }[]
}

export default function ReviewArticlesPage() {
  const router = useRouter()
  const [isSuperior, setIsSuperior] = useState(false)
  const [loading, setLoading] = useState(true)
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ uuid: string, action: 'reject' | 'accept' } | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<ArticleData | null>(null)
  const [showArticleModal, setShowArticleModal] = useState(false)

  // Verifica se l'utente è autorizzato
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const superiorEmails = JSON.parse(process.env.NEXT_PUBLIC_SUPERIOR_EMAILS || "[]")
      
      if (user && superiorEmails.includes(user.email || '')) {
        setIsSuperior(true)
        // Impostazione iniziale
        fetchArticles()
      } else {
        router.push('/')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  // Funzione per recuperare gli articoli in revisione
  const fetchArticles = async () => {
    try {
      setLoading(true)
      const articlesRef = ref(db, 'articoli')
      const snapshot = await get(articlesRef)
      
      if (snapshot.exists()) {
        const pendingReviewArticles: ArticleData[] = []
        
        snapshot.forEach((childSnapshot) => {
          const article = {
            uuid: childSnapshot.key || '',
            ...childSnapshot.val()
          } as ArticleData;
          
          // Filtra solo gli articoli in revisione
          if (article.status === 'revision') {
            pendingReviewArticles.push(article)
          }
        })
        
        setArticles(pendingReviewArticles)
      } else {
        setArticles([])
      }
    } catch (error) {
      console.error("Errore nel recupero degli articoli:", error)
      showNotification("error", "Errore nel recupero degli articoli")
    } finally {
      setLoading(false)
    }
  }

  // Funzione per accettare un articolo
  const acceptArticle = async (uuid: string) => {
    try {
      const articleRef = ref(db, `articoli/${uuid}`)
      await update(articleRef, {
        status: 'accepted'
      })
      
      // Aggiorna la lista degli articoli
      setArticles(articles.filter(article => article.uuid !== uuid))
      showNotification("success", "Articolo accettato con successo")
      setConfirmAction(null)
    } catch (error) {
      console.error("Errore durante l'accettazione:", error)
      showNotification("error", "Errore durante l'accettazione dell'articolo")
    }
  }

  // Funzione per rifiutare e eliminare un articolo
  const rejectArticle = async (uuid: string) => {
    try {
      // Trova l'articolo per ottenere l'URL dell'immagine
      const articleToDelete = articles.find(article => article.uuid === uuid);
      if (!articleToDelete) {
        throw new Error("Articolo non trovato");
      }
      
      // Elimina l'articolo dal database
      const articleRef = ref(db, `articoli/${uuid}`);
      await remove(articleRef);
      
      // Elimina l'immagine dallo storage se esiste
      if (articleToDelete.immagine && articleToDelete.immagine.includes('firebasestorage.googleapis.com')) {
        try {
          // Estrai il percorso dell'immagine dall'URL
          const storage = getStorage(app);
          const imageUrl = new URL(articleToDelete.immagine);
          const imagePath = decodeURIComponent(imageUrl.pathname.split('/o/')[1].split('?')[0]);
          const imageRef = storageRef(storage, imagePath);
          
          await deleteObject(imageRef);
          console.log("Immagine eliminata con successo");
        } catch (imageError: FirebaseError | unknown) {
          // Ignora l'errore se l'oggetto non esiste
          if (imageError instanceof FirebaseError && imageError.code === 'storage/object-not-found') {
            console.log("L'immagine non esiste più nello storage");
          } else {
            console.error("Errore durante l'eliminazione dell'immagine:", imageError);
          }
          // Continuiamo comunque anche se l'eliminazione dell'immagine fallisce
        }
      }
      
      // Aggiorna la lista degli articoli
      setArticles(articles.filter(article => article.uuid !== uuid));
      showNotification("success", "Articolo rifiutato e rimosso con successo");
      setConfirmAction(null);
    } catch (error) {
      console.error("Errore durante il rifiuto:", error);
      showNotification("error", "Errore durante il rifiuto dell'articolo");
    }
  }

  // Funzione per mostrare notifiche
  const showNotification = (type: string, message: string) => {
    setNotification({ type, message })
    
    // Rimuovi la notifica dopo 5 secondi
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  // Funzione per formattare la data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Funzione per formattare la data completa
  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('it-IT', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Filtra gli articoli in base al termine di ricerca
  const filteredArticles = articles.filter(article => 
    article.titolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.autore.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.contenuto.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Funzione per ottenere un estratto del contenuto
  const getExcerpt = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength).trim() + '...'
  }

  // Funzione per rendere il contenuto HTML sicuro
  const renderContentWithNotes = (content: string) => {
    // Semplice implementazione che restituisce il contenuto così com'è
    // In produzione, dovresti usare una libreria come DOMPurify per sanitizzare l'HTML
    return content;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!isSuperior) {
    return null // Il router reindirizza, questo è solo per sicurezza
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800 py-12 px-4 sm:px-6">
      {/* Navigazione */}
      <div className="max-w-7xl mx-auto mb-8">
        <Link href="/" className="inline-flex items-center text-zinc-800 dark:text-zinc-200 hover:opacity-80 transition-opacity">
          <FiArrowLeft className="mr-2 h-5 w-5" />
          <span className="font-serif text-lg">Torna alla home</span>
        </Link>
      </div>
      
      {/* Notifica */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all transform animate-fade-in ${
          notification.type === 'success' ? 'bg-green-500/90' : 'bg-red-500/90'
        }`}>
          <p className="text-white">{notification.message}</p>
        </div>
      )}
      
      {/* Popup di conferma azione */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-6">
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                confirmAction.action === 'reject' 
                  ? 'bg-red-100 dark:bg-red-900/30' 
                  : 'bg-green-100 dark:bg-green-900/30'
              }`}>
                {confirmAction.action === 'reject' ? (
                  <FiX className="h-6 w-6 text-red-600 dark:text-red-400" />
                ) : (
                  <FiCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                )}
              </div>
              <h2 className="text-xl font-serif font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                {confirmAction.action === 'reject' 
                  ? 'Conferma rifiuto' 
                  : 'Conferma accettazione'}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300">
                {confirmAction.action === 'reject' 
                  ? 'Sei sicuro di voler rifiutare e eliminare questo articolo? Questa azione non può essere annullata.' 
                  : 'Sei sicuro di voler approvare questo articolo? Sarà pubblicato immediatamente.'}
              </p>
            </div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors duration-200 cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => confirmAction.action === 'reject' 
                  ? rejectArticle(confirmAction.uuid) 
                  : acceptArticle(confirmAction.uuid)
                }
                className={`px-4 py-2 rounded-xl text-white transition-colors duration-200 cursor-pointer ${
                  confirmAction.action === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {confirmAction.action === 'reject' ? 'Rifiuta' : 'Accetta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal per visualizzare l'articolo completo */}
      {showArticleModal && selectedArticle && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-8 overflow-hidden">
          <div className="bg-white dark:bg-zinc-900 w-full h-full sm:h-auto sm:max-h-[90vh] sm:w-auto sm:max-w-4xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between bg-white/10 dark:bg-zinc-800/50 p-4 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center">
                <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center mr-3">
                  <FiEye className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Anteprima Articolo</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Visualizzazione articolo in revisione
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Pulsanti azione per articoli in revisione */}
                <button
                  onClick={() => {
                    setConfirmAction({ uuid: selectedArticle.uuid, action: 'reject' })
                    setShowArticleModal(false)
                  }}
                  className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors duration-200 cursor-pointer"
                  title="Rifiuta articolo"
                >
                  <FiX className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    setConfirmAction({ uuid: selectedArticle.uuid, action: 'accept' })
                    setShowArticleModal(false)
                  }}
                  className="p-2 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors duration-200 cursor-pointer"
                  title="Approva articolo"
                >
                  <FiCheck className="h-5 w-5" />
                </button>
                
                {/* Chiudi popup */}
                <button
                  onClick={() => {
                    setSelectedArticle(null)
                    setShowArticleModal(false)
                  }}
                  className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-200 cursor-pointer"
                  title="Chiudi anteprima"
                >
                  <FiMinimize2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Contenuto scrollabile */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              {/* Badge di stato nell'anteprima articolo */}
              <div className="inline-block px-3 py-1 bg-purple-500 text-white text-xs font-medium tracking-wider rounded-full shadow-lg mb-4">
                IN REVISIONE
              </div>
              
              {/* Immagine principale */}
              <div className="relative w-full aspect-video max-w-3xl mx-auto mb-8 rounded-xl overflow-hidden">
                <Image
                  src={selectedArticle.immagine}
                  alt={selectedArticle.titolo}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-image.jpg';
                  }}
                />
              </div>
              
              {/* Titolo e info */}
              <article className="max-w-3xl mx-auto">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                  {selectedArticle.titolo}
                </h1>
                
                <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">Autore:</span>
                      <span className="text-zinc-600 dark:text-zinc-400">{selectedArticle.autore}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">Data:</span>
                      <span className="text-zinc-600 dark:text-zinc-400">{formatFullDate(selectedArticle.creazione)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 ml-auto">
                    <div className="flex items-center text-zinc-600 dark:text-zinc-400" title="Visualizzazioni">
                      <FiEye className="mr-1 h-4 w-4" />
                      <span>{selectedArticle.view || 0}</span>
                    </div>
                    <div className="flex items-center text-zinc-600 dark:text-zinc-400" title="Mi piace">
                      <FiHeart className="mr-1 h-4 w-4" />
                      <span>{selectedArticle.upvote || 0}</span>
                    </div>
                    <div className="flex items-center text-zinc-600 dark:text-zinc-400" title="Condivisioni">
                      <FiShare2 className="mr-1 h-4 w-4" />
                      <span>{selectedArticle.shared || 0}</span>
                    </div>
                  </div>
                </div>
                
                {/* Tag */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {selectedArticle.tag?.split(',').map((tag, index) => (
                    <span 
                      key={index} 
                      className="px-3 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 rounded-full"
                    >
                      {tag.trim().toUpperCase()}
                    </span>
                  ))}
                </div>
                
                {/* Contenuto */}
                <div 
                  className="prose prose-zinc dark:prose-invert max-w-none 
                    text-lg leading-relaxed tracking-wide text-zinc-700 dark:text-zinc-300
                    [&>p]:mb-4 [&>p]:leading-relaxed [&>p]:tracking-wide
                    [&>*]:tracking-wide [&>*]:leading-relaxed
                    [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-6 [&>h2]:mb-4
                    [&>h3]:text-lg [&>h3]:font-bold [&>h3]:mt-5 [&>h3]:mb-3
                    [&_a]:text-amber-500 [&_a]:no-underline [&_a]:cursor-pointer
                    [&_a:hover]:text-amber-600 dark:[&_a]:text-amber-500 
                    dark:[&_a:hover]:text-amber-400 [&_a]:transition-colors [&_a]:duration-200"
                  dangerouslySetInnerHTML={{ 
                    __html: renderContentWithNotes(selectedArticle.contenuto) 
                  }}
                >
                </div>
                
                {/* Link aggiuntivi */}
                {selectedArticle.additionalLinks && selectedArticle.additionalLinks.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                    <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-300 mb-4">Link correlati</h3>
                    <div className="flex flex-wrap gap-3">
                      {selectedArticle.additionalLinks.map((link, index) => (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-amber-600 dark:text-amber-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <span>{link.label}</span>
                          <svg className="h-3.5 w-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            </div>
          </div>
        </div>
      )}
      
      {/* Contenuto principale */}
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Revisione Articoli
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-300 text-sm sm:text-base">
            Approva o rifiuta gli articoli in attesa di revisione
          </p>
        </div>
        
        {/* Barra di ricerca */}
        {articles.length > 0 && (
          <div className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl shadow-xl p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="w-full">
                <input
                  type="text"
                  placeholder="Cerca articoli..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Articoli da revisionare */}
        {filteredArticles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredArticles.map((article) => (
              <div 
                key={article.uuid}
                className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden transition-all duration-500 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_20px_60px_-15px_rgba(255,255,255,0.1)]"
              >
                {/* Intestazione con immagine */}
                <div className="relative w-full h-48">
                  <Image
                    src={article.immagine}
                    alt={article.titolo}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-image.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
                  
                  {/* Badge di stato */}
                  <div className="absolute top-3 left-3 px-3 py-1 bg-purple-500 text-white text-xs font-medium tracking-wider rounded-full shadow-lg">
                    IN REVISIONE
                  </div>
                  
                  {/* Autore e data */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="flex items-center justify-between text-white">
                      <div>
                        <p className="font-medium">{article.autore}</p>
                        <p className="text-xs opacity-80">{formatDate(article.creazione)}</p>
                      </div>
                      
                      {/* Tag */}
                      <div className="flex flex-wrap gap-1 justify-end">
                        {article.tag?.split(',').slice(0, 2).map((tag, index) => (
                          <span 
                            key={index} 
                            className="px-2 py-0.5 text-xs font-medium bg-white/20 rounded-full backdrop-blur-sm"
                          >
                            {tag.trim().toUpperCase()}
                          </span>
                        ))}
                        {article.tag?.split(',').length > 2 && (
                          <span className="text-xs opacity-80">+{article.tag.split(',').length - 2}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Contenuto */}
                <div className="p-5">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
                    {article.titolo}
                  </h2>
                  <div className="text-sm text-zinc-600 dark:text-zinc-300 mb-5 line-clamp-3">
                    {getExcerpt(article.contenuto, 160)}
                  </div>
                  
                  {/* Statistiche */}
                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <div className="flex gap-3">
                      <div className="flex items-center text-zinc-600 dark:text-zinc-400" title="Visualizzazioni">
                        <FiEye className="mr-1 h-4 w-4" />
                        <span>{article.view || 0}</span>
                      </div>
                      <div className="flex items-center text-zinc-600 dark:text-zinc-400" title="Mi piace">
                        <FiHeart className="mr-1 h-4 w-4" />
                        <span>{article.upvote || 0}</span>
                      </div>
                      <div className="flex items-center text-zinc-600 dark:text-zinc-400" title="Condivisioni">
                        <FiShare2 className="mr-1 h-4 w-4" />
                        <span>{article.shared || 0}</span>
                      </div>
                    </div>
                    
                    {/* Pulsanti di azione */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setConfirmAction({ uuid: article.uuid, action: 'reject' })}
                        className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors duration-200 cursor-pointer"
                        title="Rifiuta articolo"
                      >
                        <FiX className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setConfirmAction({ uuid: article.uuid, action: 'accept' })}
                        className="p-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors duration-200 cursor-pointer"
                        title="Approva articolo"
                      >
                        <FiCheck className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedArticle(article)
                          setShowArticleModal(true)
                        }}
                        className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors duration-200 cursor-pointer"
                        title="Visualizza articolo"
                      >
                        <FiMaximize2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl shadow-2xl p-12 text-center">
            <FiAlertCircle className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4" />
            <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
              Nessun articolo da revisionare
            </h3>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              {searchTerm 
                ? 'Nessun articolo corrisponde ai criteri di ricerca' 
                : 'Al momento non ci sono articoli in attesa di revisione'}
            </p>
          </div>
        )}
      </div>
    </main>
  )
} 