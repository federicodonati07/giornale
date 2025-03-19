"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { FiArrowLeft, FiEdit2, FiTrash2, FiEye, FiHeart, FiShare2, FiAlertCircle, FiX, FiSave, FiUser, FiUsers } from "react-icons/fi"
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage"
import { ref, get, remove, update } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import Select, { MultiValue } from "react-select"
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
  additionalLinks?: { label: string; url: string }[]
}

interface TagOption {
  value: string;
  label: string;
}

export default function ManageArticlesPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null)
  const [sortBy, setSortBy] = useState<keyof ArticleData>('creazione')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [editArticle, setEditArticle] = useState<ArticleData | null>(null)
  const [availableTags] = useState<TagOption[]>([
    { value: 'ATTUALITÀ', label: 'ATTUALITÀ' },
    { value: 'POLITICA', label: 'POLITICA' },
    { value: 'ESTERO', label: 'ESTERO' },
    { value: 'ECONOMIA', label: 'ECONOMIA' },
    { value: 'TECNOLOGIA', label: 'TECNOLOGIA' },
    { value: 'SPORT', label: 'SPORT' },
    { value: 'AVIAZIONE', label: 'AVIAZIONE' },
    { value: 'SCIENZE', label: 'SCIENZE' },
    { value: 'MEDICINA', label: 'MEDICINA' },
    { value: 'NATURA', label: 'NATURA' },
    { value: 'ITALIA', label: 'ITALIA' }
  ])
  const [newLink, setNewLink] = useState({ url: '', label: '' })
  const [newNote, setNewNote] = useState({ text: '', content: '' })
  const [notes, setNotes] = useState<Array<{ text: string, content: string }>>([])

  // Verifica se l'utente è autorizzato
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const adminEmails = [
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_1,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_2,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_3,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_4
      ]
      
      if (user && adminEmails.includes(user.email || '')) {
        setIsAdmin(true)
        fetchArticles()
      } else {
        router.push('/')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  // Funzione per recuperare gli articoli
  const fetchArticles = async () => {
    try {
      setLoading(true)
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
        
        setArticles(articlesData)
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

  // Funzione per eliminare un articolo
  const deleteArticle = async (uuid: string) => {
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
      showNotification("success", "Articolo eliminato con successo");
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Errore durante l'eliminazione:", error);
      showNotification("error", "Errore durante l'eliminazione dell'articolo");
    }
  }

  // Funzione per aggiornare un articolo
  const updateArticle = async () => {
    if (!editArticle) return;
    
    try {
      const articleRef = ref(db, `articoli/${editArticle.uuid}`);
      
      // Aggiorniamo solo i campi modificabili
      const updates = {
        titolo: editArticle.titolo,
        contenuto: editArticle.contenuto,
        tag: editArticle.tag,
        partecipanti: editArticle.partecipanti || "",
        isPrivate: editArticle.isPrivate,
        additionalLinks: editArticle.additionalLinks || []
      };
      
      await update(articleRef, updates);
      
      // Aggiorna la lista degli articoli
      setArticles(articles.map(article => 
        article.uuid === editArticle.uuid ? {...article, ...updates} : article
      ));
      
      showNotification("success", "Articolo aggiornato con successo");
      setEditArticle(null);
    } catch (error) {
      console.error("Errore durante l'aggiornamento:", error);
      showNotification("error", "Errore durante l'aggiornamento dell'articolo");
    }
  }

  // Funzione per gestire il cambio dei tag
  const handleTagChange = (selectedOptions: MultiValue<TagOption>) => {
    if (!editArticle) return;
    
    // Verifica che ci sia almeno un tag selezionato
    if (selectedOptions.length === 0) {
      showNotification("error", "È necessario selezionare almeno un tag");
      return;
    }
    
    // Converti tutti i tag in maiuscolo
    const selectedTags = selectedOptions.map((option) => option.value.toUpperCase()).join(',');
    setEditArticle({...editArticle, tag: selectedTags});
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

  // Funzione per ordinare gli articoli
  const sortArticles = (a: ArticleData, b: ArticleData) => {
    if (sortBy === 'creazione') {
      const dateA = new Date(a[sortBy]).getTime()
      const dateB = new Date(b[sortBy]).getTime()
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
    }
    
    if (typeof a[sortBy] === 'number' && typeof b[sortBy] === 'number') {
      return sortDirection === 'asc' 
        ? (a[sortBy] as number) - (b[sortBy] as number) 
        : (b[sortBy] as number) - (a[sortBy] as number)
    }
    
    const valueA = String(a[sortBy]).toLowerCase()
    const valueB = String(b[sortBy]).toLowerCase()
    return sortDirection === 'asc' 
      ? valueA.localeCompare(valueB) 
      : valueB.localeCompare(valueA)
  }

  // Funzione per cambiare l'ordinamento
  const handleSort = (column: keyof ArticleData) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('desc')
    }
  }

  // Filtra gli articoli in base al termine di ricerca
  const filteredArticles = articles.filter(article => 
    article.titolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.autore.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.contenuto.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort(sortArticles)

  // Funzione per ottenere un estratto del contenuto
  const getExcerpt = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength).trim() + '...'
  }

  // Funzione per aggiungere un nuovo link
  const handleAddLink = () => {
    if (!editArticle) return
    
    if (!newLink.url || !newLink.label) {
      showNotification('error', 'Inserisci sia URL che etichetta per il link')
      return
    }

    if (!newLink.url.startsWith('http://') && !newLink.url.startsWith('https://')) {
      showNotification('error', "L'URL deve iniziare con http:// o https://")
      return
    }

    setEditArticle({
      ...editArticle,
      additionalLinks: [...(editArticle.additionalLinks || []), newLink]
    })
    
    // Reset form
    setNewLink({ url: '', label: '' })
  }

  // Funzione per aggiungere una nuova nota
  const handleAddNote = () => {
    if (!newNote.text || !newNote.content) {
      showNotification('error', 'Inserisci sia il testo che il contenuto della nota')
      return
    }

    setNotes([...notes, newNote])
    setNewNote({ text: '', content: '' })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!isAdmin) {
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
      
      {/* Popup di modifica */}
      {editArticle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-serif font-bold text-zinc-900 dark:text-zinc-50">
                  Modifica Articolo
                </h2>
                <button 
                  onClick={() => setEditArticle(null)}
                  className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors duration-200"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Titolo */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Titolo
                  </label>
                  <input
                    type="text"
                    value={editArticle.titolo}
                    onChange={(e) => setEditArticle({...editArticle, titolo: e.target.value})}
                    className="w-full p-4 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                  />
                </div>

                {/* Autore */}
                <div className="relative">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Autore
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                      <FiUser className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      value={editArticle.autore}
                      onChange={(e) => setEditArticle({...editArticle, autore: e.target.value})}
                      className="w-full pl-10 p-4 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                    />
                  </div>
                </div>

                {/* Partecipanti */}
                <div className="relative">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Partecipanti
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                      <FiUsers className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      value={editArticle.partecipanti || ""}
                      onChange={(e) => setEditArticle({...editArticle, partecipanti: e.target.value})}
                      className="w-full pl-10 p-4 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                      placeholder="Altri partecipanti all'articolo"
                    />
                  </div>
                </div>

                {/* Tag */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Tag
                  </label>
                  <Select
                    isMulti
                    name="tags"
                    options={availableTags}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    value={editArticle.tag.split(',').map(tag => ({ 
                      value: tag.trim().toUpperCase(), 
                      label: tag.trim().toUpperCase() 
                    }))}
                    onChange={handleTagChange}
                    styles={{
                      control: (baseStyles) => ({
                        ...baseStyles,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(228, 228, 231, 0.5)',
                        borderRadius: '0.75rem',
                        padding: '0.25rem',
                        boxShadow: 'none',
                        '&:hover': {
                          borderColor: 'rgba(59, 130, 246, 0.5)'
                        }
                      }),
                      menu: (baseStyles) => ({
                        ...baseStyles,
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '0.75rem',
                        overflow: 'hidden'
                      }),
                      option: (baseStyles, state) => ({
                        ...baseStyles,
                        backgroundColor: state.isSelected 
                          ? 'rgba(59, 130, 246, 0.8)'
                          : state.isFocused 
                            ? 'rgba(59, 130, 246, 0.2)'
                            : 'transparent',
                        color: state.isSelected ? 'white' : 'white',
                        '&:hover': {
                          backgroundColor: 'rgba(59, 130, 246, 0.3)'
                        }
                      })
                    }}
                  />
                </div>

                {/* Toggle Visibilità */}
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between p-4 bg-white/5 dark:bg-zinc-800/20 rounded-xl border border-white/10 dark:border-zinc-700/50">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        Visibilità articolo
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {editArticle.isPrivate 
                          ? "Solo gli utenti registrati potranno vedere questo articolo" 
                          : "L'articolo è visibile a tutti"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditArticle({
                        ...editArticle,
                        isPrivate: !editArticle.isPrivate
                      })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300
                        ${editArticle.isPrivate 
                          ? 'bg-amber-500' 
                          : 'bg-zinc-300 dark:bg-zinc-600'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300
                          ${editArticle.isPrivate ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Note aggiuntive */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Note aggiuntive
                  </label>
                  
                  {/* Form per aggiungere note */}
                  <div className="flex gap-3 mb-4">
                    <input
                      type="text"
                      placeholder="Testo della nota"
                      value={newNote.text}
                      onChange={(e) => setNewNote({ ...newNote, text: e.target.value })}
                      className="flex-1 p-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Contenuto della nota"
                      value={newNote.content}
                      onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                      className="flex-1 p-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                    />
                    <button
                      onClick={handleAddNote}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors duration-200"
                    >
                      Aggiungi Nota
                    </button>
                  </div>

                  {/* Lista delle note */}
                  <div className="space-y-4">
                    {notes.map((note, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-xl">
                        <div className="flex flex-col">
                          <span className="font-medium">{note.text}</span>
                          <span className="text-sm opacity-75">{note.content}</span>
                        </div>
                        <button
                          onClick={() => {
                            const newNotes = [...notes];
                            newNotes.splice(index, 1);
                            setNotes(newNotes);
                          }}
                          className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                          <FiX className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editor del contenuto */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Contenuto
                  </label>
                  <textarea
                    value={editArticle.contenuto}
                    onChange={(e) => setEditArticle({...editArticle, contenuto: e.target.value})}
                    rows={15}
                    className="w-full p-4 bg-white/5 border border-white/20 rounded-xl 
                      focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                      transition-all duration-300 text-zinc-900 dark:text-zinc-50 
                      outline-none font-montserrat resize-y"
                  />
                  <div className="mt-4">
                    {notes.map((note, index) => (
                      <span key={index} className="relative group">
                        <span className="underline cursor-pointer">{note.text}</span>
                        <div className="absolute left-0 mt-1 w-64 p-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          {note.content}
                        </div>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Link aggiuntivi */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Link aggiuntivi
                  </label>
                  
                  {/* Form per aggiungere link */}
                  <div className="flex gap-3 mb-4">
                    <input
                      type="text"
                      placeholder="URL del link"
                      value={newLink.url}
                      onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                      className="flex-1 p-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Etichetta del link"
                      value={newLink.label}
                      onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
                      className="flex-1 p-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                    />
                    <button
                      onClick={handleAddLink}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors duration-200"
                    >
                      Aggiungi
                    </button>
                  </div>

                  {/* Lista dei link */}
                  <div className="space-y-4">
                    {editArticle.additionalLinks?.map((link, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-xl">
                        <div className="flex flex-col">
                          <span className="font-medium">{link.label}</span>
                          <span className="text-sm opacity-75">{link.url}</span>
                        </div>
                        <button
                          onClick={() => {
                            const newLinks = [...(editArticle.additionalLinks || [])];
                            newLinks.splice(index, 1);
                            setEditArticle({...editArticle, additionalLinks: newLinks});
                          }}
                          className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                          <FiX className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pulsanti azioni */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setEditArticle(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors duration-200"
                >
                  Annulla
                </button>
                <button
                  onClick={updateArticle}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
                >
                  <FiSave className="h-4 w-4" />
                  Salva modifiche
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Popup di conferma eliminazione */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <FiAlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-serif font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                Conferma eliminazione
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300">
                Sei sicuro di voler eliminare questo articolo? Questa azione non può essere annullata.
              </p>
            </div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors duration-200 cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => deleteArticle(deleteConfirm)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors duration-200 cursor-pointer"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Contenuto principale */}
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Gestione Articoli
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-300 text-sm sm:text-base">
            Visualizza, modifica ed elimina gli articoli pubblicati
          </p>
        </div>
        
        {/* Barra di ricerca e filtri */}
        <div className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl shadow-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="w-full">
              <input
                type="text"
                placeholder="Cerca articoli..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
              />
            </div>
          </div>
        </div>
        
        {/* Tabella articoli */}
        <div className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl shadow-2xl p-4 overflow-x-auto transition-all duration-500 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_20px_60px_-15px_rgba(255,255,255,0.1)]">
          {filteredArticles.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="p-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400">Immagine</th>
                  <th 
                    className="p-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-blue-500 dark:hover:text-blue-400"
                    onClick={() => handleSort('titolo')}
                  >
                    Titolo {sortBy === 'titolo' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="p-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-blue-500 dark:hover:text-blue-400"
                    onClick={() => handleSort('autore')}
                  >
                    Autore {sortBy === 'autore' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="p-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-blue-500 dark:hover:text-blue-400"
                    onClick={() => handleSort('creazione')}
                  >
                    Data {sortBy === 'creazione' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400">Tag</th>
                  <th className="p-3 text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">Statistiche</th>
                  <th className="p-3 text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.map((article) => (
                  <tr 
                    key={article.uuid} 
                    className="border-b border-white/10 hover:bg-white/5 dark:hover:bg-zinc-800/40 transition-colors duration-200"
                  >
                    {/* Immagine */}
                    <td className="p-3 w-16">
                      <div className="relative h-12 w-12 rounded-md overflow-hidden">
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
                      </div>
                    </td>
                    
                    {/* Titolo */}
                    <td className="p-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{article.titolo}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                        {getExcerpt(article.contenuto, 80)}
                      </div>
                    </td>
                    
                    {/* Autore */}
                    <td className="p-3">
                      <div className="text-zinc-800 dark:text-zinc-200">{article.autore}</div>
                      {article.partecipanti && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          Con: {article.partecipanti}
                        </div>
                      )}
                    </td>
                    
                    {/* Data */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="text-zinc-800 dark:text-zinc-200">
                        {formatDate(article.creazione)}
                      </div>
                    </td>
                    
                    {/* Tag */}
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {article.tag?.split(',').map((tag, index) => (
                          <span 
                            key={index} 
                            className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full"
                          >
                            {tag.trim().toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                    
                    {/* Statistiche */}
                    <td className="p-3">
                      <div className="flex justify-center gap-4">
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
                    </td>
                    
                    {/* Azioni */}
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => setEditArticle(article)}
                          className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors duration-200 cursor-pointer"
                          title="Modifica articolo"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        
                        <button 
                          className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 cursor-pointer"
                          onClick={() => setDeleteConfirm(article.uuid)}
                          title="Elimina articolo"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center">
              <FiAlertCircle className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4" />
              <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">Nessun articolo trovato</h3>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                {searchTerm ? 'Prova a modificare i criteri di ricerca' : 'Non ci sono articoli pubblicati'}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
} 