"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { FiArrowLeft, FiTrash2, FiEye, FiHeart, FiShare2, FiAlertCircle, FiX, FiTrendingUp, FiUsers, FiChevronDown, FiPlus, FiUser, FiCheck } from "react-icons/fi"
import { getStorage, ref as storageRef, deleteObject, uploadBytes, getDownloadURL } from "firebase/storage"
import { ref, get, remove, update } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth, db, app } from "../../firebase"
import { motion, useScroll, useTransform } from "framer-motion"
import { v4 as uuidv4 } from 'uuid'
import { Button } from "@/app/components/ui/button"

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
  status?: string
  scheduleDate?: string
  secondaryNotes?: { id: string; content: string }[]
}

export default function ManageArticlesPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperior, setIsSuperior] = useState(false)
  const [loading, setLoading] = useState(true)
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null)
  const [sortBy, setSortBy] = useState<keyof ArticleData>('creazione')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [editingArticle, setEditingArticle] = useState<ArticleData | null>(null)
  const [editFormData, setEditFormData] = useState({
    titolo: '',
    contenuto: '',
    tag: '',
    autore: '',
    partecipanti: '',
    isPrivate: false,
    immagine: '',
    additionalLinks: [] as Array<{ url: string, label: string }>,
    secondaryNotes: [] as Array<{ id: string, content: string }>,
    newNoteContent: '',
    newLinkUrl: '',
    newLinkLabel: ''
  })
  const [displayedArticles, setDisplayedArticles] = useState<number>(5)
  const [participants, setParticipants] = useState<string[]>([])
  const [newParticipant, setNewParticipant] = useState('')
  const [showParticipantsDropdown, setShowParticipantsDropdown] = useState(false)
  const participantsDropdownRef = useRef<HTMLDivElement>(null)
  const [authors, setAuthors] = useState<string[]>([])
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false)
  const authorDropdownRef = useRef<HTMLDivElement>(null)

  // Add scroll tracking for parallax effects
  const { scrollY } = useScroll()
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Define all transform values at the top level
  const headerY = useTransform(scrollY, [0, 300], [0, -50])
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.8])
  const bgElement1Y = useTransform(scrollY, [0, 500], [0, -150])
  const bgElement2Y = useTransform(scrollY, [0, 500], [0, 100])
  const tableShadow = useTransform(scrollY, [0, 200], [0, 20])
  const tableBoxShadow = useTransform(
    tableShadow, 
    value => `0 ${value}px ${value * 3}px -15px rgba(0,0,0,0.3), 0 ${value/2}px ${value}px -${value/2}px rgba(255,255,255,0.1)`
  )
  
  // Enhance with additional transform values
  const titleScale = useTransform(scrollY, [0, 200], [1, 0.92])
  const titleY = useTransform(scrollY, [0, 200], [0, -10])
  const searchBarY = useTransform(scrollY, [0, 200], [0, -5])
  const tableOpacity = useTransform(scrollY, [0, 100], [0.95, 1])
  const tableY = useTransform(scrollY, [0, 100], [15, 0])


  // Aggiungi le categorie disponibili
  const availableCategories = [
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
  ];

  // Verifica se l'utente è autorizzato
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const superiorEmails = JSON.parse(process.env.NEXT_PUBLIC_SUPERIOR_EMAILS || "[]")
      
      if (user) {
        // Verifica se l'email è verificata per gli accessi con email/password
        if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
          // Se l'email non è verificata, reindirizza alla pagina di verifica
          router.push('/verify-email');
          return;
        }
        
        // Verifica se l'utente è un revisore superiore
        if (superiorEmails.includes(user.email || '')) {
          setIsAdmin(true)
          setIsSuperior(true)
          fetchArticles()
        } else {
          // Reindirizza alla home page se non è un utente SUPERIOR
          router.push('/')
        }
      } else {
        // Reindirizza alla home page se non è loggato
        router.push('/')
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  // Modifica l'useEffect per l'inizializzazione del contenuto
  useEffect(() => {
    if (editingArticle) {
      const editorContent = document.getElementById('article-content');
      if (editorContent) {
        // Imposta il contenuto iniziale
        editorContent.innerHTML = editFormData.contenuto || '';
        
        // Aggiungi un placeholder se il contenuto è vuoto
        if (!editFormData.contenuto) {
          editorContent.dataset.empty = 'true';
        } else {
          delete editorContent.dataset.empty;
        }
      }
    }
  }, [editingArticle, editFormData.contenuto]);

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

  // Filtra gli articoli in base al termine di ricerca e status
  const filteredArticles = articles.filter(article => 
    // Filtra per termine di ricerca
    (article.titolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
     article.autore.toLowerCase().includes(searchTerm.toLowerCase()) ||
     article.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
     article.contenuto.toLowerCase().includes(searchTerm.toLowerCase())) &&
    // Nascondi gli articoli con status 'revision'
    article.status !== 'revision'
  ).sort(sortArticles)

  // Funzione per ottenere un estratto del contenuto
  const getExcerpt = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength).trim() + '...'
  }

  // Aggiungi la funzione per gestire la sospensione/riattivazione
  const toggleArticleStatus = async (article: ArticleData) => {
    try {
      const articleRef = ref(db, `articoli/${article.uuid}`);
      const newStatus = article.status === 'suspended' ? 'accepted' : 'suspended';
      
      await update(articleRef, {
        status: newStatus
      });
      
      // Aggiorna lo stato locale
      setArticles(articles.map(a => 
        a.uuid === article.uuid 
          ? { ...a, status: newStatus }
          : a
      ));
      
      showNotification(
        "success", 
        newStatus === 'suspended' 
          ? "Articolo sospeso con successo"
          : "Articolo riattivato con successo"
      );
    } catch (error) {
      console.error("Errore durante l'aggiornamento dello stato:", error);
      showNotification("error", "Errore durante l'aggiornamento dello stato dell'articolo");
    }
  };

  // Sostituisci queste due funzioni con il nuovo approccio
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditFormData(prev => ({
      ...prev,
      contenuto: e.target.value
    }));
  };

  // Modifica la funzione handleTagChange per gestire la selezione dei tag
  const handleTagChange = (category: string) => {
    const currentTags = editFormData.tag
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    if (currentTags.includes(category)) {
      // Rimuovi il tag se già presente
      const updatedTags = currentTags.filter(tag => tag !== category);
      setEditFormData({
        ...editFormData,
        tag: updatedTags.join(', ')
      });
    } else {
      // Aggiungi il tag solo se non abbiamo già 3 tag selezionati
      if (currentTags.length >= 3) {
        showNotification("error", "Non puoi selezionare più di 3 tag");
        return;
      }
      
      // Aggiungi il tag se non è presente
      const updatedTags = [...currentTags, category];
      setEditFormData({
        ...editFormData,
        tag: updatedTags.join(', ')
      });
    }
  };

  // Aggiungi la funzione per gestire il salvataggio delle modifiche
  const handleSaveEdit = async () => {
    if (!editingArticle) return;
    
    try {
      const articleRef = ref(db, `articoli/${editingArticle.uuid}`);
      await update(articleRef, {
        titolo: editFormData.titolo,
        contenuto: editFormData.contenuto, // Ora contiene direttamente l'HTML
        tag: editFormData.tag.split(',').map(t => t.trim()).join(', '),
        autore: editFormData.autore,
        partecipanti: editFormData.partecipanti,
        isPrivate: editFormData.isPrivate,
        immagine: editFormData.immagine,
        additionalLinks: editFormData.additionalLinks,
        secondaryNotes: editFormData.secondaryNotes
      });
      
      // Aggiorna la lista degli articoli
      setArticles(articles.map(article => 
        article.uuid === editingArticle.uuid 
          ? { 
              ...article, 
              ...editFormData,
              tag: editFormData.tag.split(',').map(t => t.trim()).join(', ')
            }
          : article
      ));
      
      setEditingArticle(null);
      showNotification("success", "Articolo aggiornato con successo");
    } catch (error) {
      console.error("Errore durante l'aggiornamento:", error);
      showNotification("error", "Errore durante l'aggiornamento dell'articolo");
    }
  };

  // Aggiungi la funzione per gestire l'upload dell'immagine
  const handleImageUpload = async (file: File) => {
    if (!editingArticle) return;

    try {
      const storage = getStorage(app);
      
      // Se esiste già un'immagine, eliminala
      if (editingArticle.immagine && editingArticle.immagine.includes('firebasestorage.googleapis.com')) {
        try {
          const oldImageUrl = new URL(editingArticle.immagine);
          const oldImagePath = decodeURIComponent(oldImageUrl.pathname.split('/o/')[1].split('?')[0]);
          const oldImageRef = storageRef(storage, oldImagePath);
          await deleteObject(oldImageRef);
        } catch (error) {
          console.error("Errore durante l'eliminazione della vecchia immagine:", error);
        }
      }

      // Carica la nuova immagine
      const imageRef = storageRef(storage, `articles/${editingArticle.uuid}/${file.name}`);
      await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(imageRef);

      setEditFormData(prev => ({
        ...prev,
        immagine: downloadURL
      }));

      showNotification("success", "Immagine caricata con successo");
    } catch (error) {
      console.error("Errore durante il caricamento dell'immagine:", error);
      showNotification("error", "Errore durante il caricamento dell'immagine");
    }
  };

  // Aggiungi funzioni per gestire le note secondarie
  const handleAddSecondaryNote = () => {
    if (!editFormData.newNoteContent.trim()) {
      showNotification('error', 'La nota non può essere vuota');
      return;
    }

    const newNote = {
      id: uuidv4(),
      content: editFormData.newNoteContent.trim()
    };

    setEditFormData(prev => ({
      ...prev,
      secondaryNotes: [...prev.secondaryNotes, newNote],
      newNoteContent: ''
    }));
  };

  const handleRemoveSecondaryNote = (idToRemove: string) => {
    setEditFormData(prev => ({
      ...prev,
      secondaryNotes: prev.secondaryNotes.filter(note => note.id !== idToRemove)
    }));
  };

  // Aggiungi funzioni per gestire i link aggiuntivi
  const handleAddLink = () => {
    if (!editFormData.newLinkUrl || !editFormData.newLinkLabel) {
      showNotification('error', 'Inserisci sia URL che etichetta per il link');
      return;
    }

    setEditFormData(prev => ({
      ...prev,
      additionalLinks: [...prev.additionalLinks, { url: editFormData.newLinkUrl, label: editFormData.newLinkLabel }],
      newLinkUrl: '',
      newLinkLabel: ''
    }));
  };

  const handleRemoveLink = (indexToRemove: number) => {
    setEditFormData(prev => ({
      ...prev,
      additionalLinks: prev.additionalLinks.filter((_, index) => index !== indexToRemove)
    }));
  };

  // Function to increase displayed articles by 5
  const loadMoreArticles = () => {
    setDisplayedArticles(prev => prev + 5);
  };

  // Aggiungi questa funzione per calcolare il punteggio delle prestazioni
  const calculatePerformanceScore = (article: ArticleData) => {
    // Calcola i valori medi per visualizzazioni, upvote e condivisioni
    const avgViews = articles.reduce((sum, art) => sum + (art.view || 0), 0) / articles.length || 1;
    const avgUpvotes = articles.reduce((sum, art) => sum + (art.upvote || 0), 0) / articles.length || 1;
    const avgShares = articles.reduce((sum, art) => sum + (art.shared || 0), 0) / articles.length || 1;
    
    // Calcola i punteggi normalizzati rispetto alla media (con pesi diversi)
    const viewScore = ((article.view || 0) / avgViews) * 40; // 40% del peso
    const upvoteScore = ((article.upvote || 0) / avgUpvotes) * 40; // 40% del peso
    const shareScore = ((article.shared || 0) / avgShares) * 20; // 20% del peso
    
    // Calcola il punteggio totale e limita a 200%
    const totalScore = Math.min(Math.round(viewScore + upvoteScore + shareScore), 200);
    
    return totalScore;
  };
  
  // Add useEffect for loading the article data
  useEffect(() => {
    if (editingArticle) {
      // Set other article fields...
      
      // Handle participants string to array
      if (editingArticle.partecipanti) {
        setParticipants(editingArticle.partecipanti.split(", ").map(p => p.trim()));
      } else {
        setParticipants([]);
      }
      
      // Fetch authors from Firebase
      fetchAuthors();
    }
  }, [editingArticle]);

  // Add the fetchAuthors function
  const fetchAuthors = async () => {
    try {
      const authorsRef = ref(db, 'autori');
      const snapshot = await get(authorsRef);
      
      if (snapshot.exists()) {
        const authorsData: string[] = [];
        snapshot.forEach((childSnapshot) => {
          authorsData.push(childSnapshot.val().name);
        });
        setAuthors(authorsData);
      }
    } catch (error) {
      console.error("Error fetching authors:", error);
    }
  };

  // Add handlers for participants
  const handleAddParticipant = () => {
    if (!newParticipant.trim()) {
      showNotification("error", "Il nome del partecipante non può essere vuoto");
      return;
    }
    
    if (participants.includes(newParticipant.trim())) {
      showNotification("error", "Questo partecipante è già stato aggiunto");
      return;
    }
    
    setParticipants([...participants, newParticipant.trim()]);
    setNewParticipant('');
  };

  const handleRemoveParticipant = (participantToRemove: string) => {
    setParticipants(participants.filter(p => p !== participantToRemove));
  };

  // Add handlers for author selection/addition
  const handleSelectAuthor = (selectedAuthor: string) => {
    setEditFormData(prev => ({
      ...prev,
      autore: selectedAuthor
    }));
    setShowAuthorDropdown(false);
  };

  // Add click outside handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (participantsDropdownRef.current && !participantsDropdownRef.current.contains(event.target as Node)) {
        setShowParticipantsDropdown(false);
      }
      if (authorDropdownRef.current && !authorDropdownRef.current.contains(event.target as Node)) {
        setShowAuthorDropdown(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
            borderRadius: ["20%", "50%", "20%"]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut"
          }}
          className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center"
        >
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-8 h-8 bg-white rounded-full"
          />
        </motion.div>
      </div>
    )
  }

  if (!isAdmin) {
    return null // Il router reindirizza, questo è solo per sicurezza
  }

  return (
    <motion.main 
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800 py-12 px-4 sm:px-6 overflow-hidden"
    >
      {/* Enhanced background elements with more complex animations */}
      <motion.div 
        className="fixed inset-0 pointer-events-none"
        style={{ opacity: 0.07 }}
      >
        <motion.div 
          initial={{ x: 0, y: 0 }}
          animate={{ 
            x: [0, 20, 0, -20, 0],
            y: [0, -20, 0, 20, 0]
          }}
          transition={{ 
            duration: 20, 
            repeat: Infinity,
            repeatType: "mirror", 
            ease: "easeInOut" 
          }}
          style={{ y: bgElement1Y }}
          className="absolute -top-[20%] -right-[10%] h-[70vh] w-[70vh] rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 blur-3xl"
        />
        <motion.div 
          initial={{ x: 0, y: 0 }}
          animate={{ 
            x: [0, -20, 0, 20, 0],
            y: [0, 20, 0, -20, 0]
          }}
          transition={{ 
            duration: 25, 
            repeat: Infinity,
            repeatType: "mirror", 
            ease: "easeInOut" 
          }}
          style={{ y: bgElement2Y }}
          className="absolute -bottom-[20%] -left-[10%] h-[70vh] w-[70vh] rounded-full bg-gradient-to-tr from-emerald-400 to-blue-600 blur-3xl dark:opacity-40"
        />
        
        {/* Add floating accent elements */}
        <motion.div
          initial={{ opacity: 0.5 }}
          animate={{ 
            y: [0, -30, 0],
            opacity: [0.4, 0.2, 0.4],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity,
            repeatType: "reverse"
          }}
          className="absolute top-[30%] right-[20%] h-32 w-32 rounded-full bg-amber-500/30 blur-2xl"
        />
        <motion.div
          initial={{ opacity: 0.5 }}
          animate={{ 
            y: [0, 40, 0],
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 0.9, 1]
          }}
          transition={{ 
            duration: 12, 
            repeat: Infinity,
            repeatType: "reverse",
            delay: 1
          }}
          className="absolute bottom-[40%] left-[15%] h-40 w-40 rounded-full bg-blue-500/20 blur-2xl"
        />
      </motion.div>
      
      {/* Navigation with parallax fade */}
      <motion.div 
        className="max-w-7xl mx-auto mb-8"
        style={{ y: headerY, opacity: headerOpacity }}
      >
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          whileHover={{ x: -5 }}
        >
          <Link href="/" className="inline-flex items-center text-zinc-800 dark:text-zinc-200 hover:opacity-80 transition-opacity">
            <FiArrowLeft className="mr-2 h-5 w-5" />
            <span className="font-serif text-lg">Torna alla home</span>
          </Link>
        </motion.div>
      </motion.div>
      
      {/* Notification with animation */}
      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            notification.type === 'success' ? 'bg-green-500/90' : 'bg-red-500/90'
          }`}
        >
          <p className="text-white">{notification.message}</p>
        </motion.div>
      )}
      
      {/* Popup with animation */}
      {deleteConfirm && (
        <motion.div 
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(5px)" }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-md p-6"
          >
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
          </motion.div>
        </motion.div>
      )}
      
      {/* Modale di modifica */}
      {editingArticle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif font-bold text-zinc-900 dark:text-zinc-50">
                Modifica Articolo
              </h2>
              <button
                onClick={() => setEditingArticle(null)}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Title input with character limit */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Titolo * <span className="text-xs text-zinc-500">(max 100 caratteri)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editFormData.titolo}
                    onChange={(e) => {
                      if (e.target.value.length <= 100) {
                        setEditFormData({...editFormData, titolo: e.target.value});
                      }
                    }}
                    maxLength={100}
                    className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                    placeholder="Inserisci il titolo dell'articolo"
                    required
                  />
                  <div className="absolute right-3 bottom-3 text-xs text-zinc-500">
                    {editFormData.titolo.length}/100
                  </div>
                </div>
              </div>

              {/* Note secondarie */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Note secondarie
                </label>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={editFormData.newNoteContent}
                      onChange={(e) => setEditFormData({...editFormData, newNoteContent: e.target.value})}
                      placeholder="Inserisci una nota secondaria"
                      className="flex-1 p-2 bg-white/5 border border-white/20 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                    />
                    <button
                      onClick={handleAddSecondaryNote}
                      className="cursor-pointer px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      Aggiungi Nota
                    </button>
                  </div>

                  {editFormData.secondaryNotes.length > 0 && (
                    <div className="p-4 bg-white/5 border border-white/20 rounded-xl">
                      <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                        Note inserite ({editFormData.secondaryNotes.length})
                      </h4>
                      <div className="space-y-3">
                        {editFormData.secondaryNotes.map((note, index) => (
                          <div 
                            key={note.id}
                            className="flex items-start justify-between gap-3 p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                  [{index + 1}]
                                </span>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                                  {note.content}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveSecondaryNote(note.id)}
                              className="text-zinc-400 hover:text-red-500 transition-colors"
                            >
                              <FiX className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Link aggiuntivi */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Link aggiuntivi
                </label>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={editFormData.newLinkLabel}
                      onChange={(e) => setEditFormData({...editFormData, newLinkLabel: e.target.value})}
                      placeholder="Etichetta del link"
                      className="flex-1 p-2 bg-white/5 border border-white/20 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                    />
                    <input
                      type="url"
                      value={editFormData.newLinkUrl}
                      onChange={(e) => setEditFormData({...editFormData, newLinkUrl: e.target.value})}
                      placeholder="URL"
                      className="flex-1 p-2 bg-white/5 border border-white/20 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                    />
                    <button
                      onClick={handleAddLink}
                      className="cursor-pointer px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      Aggiungi Link
                    </button>
                  </div>

                  {editFormData.additionalLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-4 bg-white/5 border border-white/20 rounded-lg">
                      {editFormData.additionalLinks.map((link, index) => (
                        <div key={index} className="flex items-center gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full">
                          <span>{link.label}</span>
                          <button
                            onClick={() => handleRemoveLink(index)}
                            className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                          >
                            <FiX className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Barra degli strumenti e Editor */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Contenuto *
                </label>
                
                {/* Editor come textarea */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Modifica HTML
                    </label>
                    <textarea
                      id="article-content-textarea"
                      value={editFormData.contenuto}
                      onChange={handleContentChange}
                      className="min-h-[300px] w-full p-4 bg-white/5 border border-white/20 rounded-xl 
                                focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                                transition-all duration-300 text-zinc-900 dark:text-zinc-50 
                                outline-none font-mono text-sm overflow-auto"
                      placeholder="Inserisci il contenuto HTML del tuo articolo..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Anteprima
                    </label>
                    <div 
                      className="h-[300px] w-full p-4 bg-white/10 border border-white/20 rounded-xl
                                overflow-y-auto prose prose-zinc dark:prose-invert max-w-none
                                [&>p]:mb-4 [&>p]:leading-relaxed [&>p]:tracking-wide
                                [&_a]:text-amber-500 [&_a]:no-underline [&_a]:cursor-pointer
                                [&_a:hover]:text-amber-600 
                                dark:[&_a]:text-amber-500 
                                dark:[&_a:hover]:text-amber-600
                                [&_a]:transition-colors [&_a]:duration-200
                                [&_[style*='background-color: #fb923c']]:text-zinc-900"
                      style={{ 
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(161, 161, 170, 0.5) transparent'
                      }}
                      dangerouslySetInnerHTML={{ __html: editFormData.contenuto }}
                    />
                  </div>
                </div>
                
                <p className="mt-2 text-xs text-zinc-500">
                  Modifica direttamente il codice HTML nella casella a sinistra. L&apos;anteprima mostra come apparirà l&apos;articolo.
                </p>
              </div>

              {/* Immagine */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Immagine
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 rounded-lg overflow-hidden">
                    <Image
                      src={editFormData.immagine}
                      alt="Anteprima"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                    className="flex-1 p-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                  />
                </div>
              </div>

              {/* Autore e Partecipanti */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Author as dropdown - simplified */}
                <div className="mb-4 relative" ref={authorDropdownRef}>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Autore *</label>
                  <div className="relative">
                    <div 
                      className="flex items-center w-full p-3 bg-white/5 border border-white/20 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none cursor-pointer"
                      onClick={() => setShowAuthorDropdown(!showAuthorDropdown)}
                    >
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                        <FiUser className="h-5 w-5" />
                      </div>
                      <div className="pl-10 flex-grow truncate">
                        {editFormData.autore || "Seleziona un autore"}
                      </div>
                      <FiChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${showAuthorDropdown ? 'rotate-180' : ''}`} />
                    </div>
                    
                    {/* Dropdown for author selection - simplified */}
                    {showAuthorDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 max-h-60 overflow-auto animate-fade-in">
                        {authors.length > 0 ? (
                          authors.map((authorName, index) => (
                            <div 
                              key={index}
                              className={`flex items-center px-3 py-2 cursor-pointer hover:bg-blue-500/10 ${
                                editFormData.autore === authorName ? 'bg-blue-500/20' : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectAuthor(authorName);
                              }}
                            >
                              <div className={`flex-shrink-0 h-4 w-4 mr-2 rounded ${
                                editFormData.autore === authorName ? 'bg-blue-500 flex items-center justify-center' : ''
                              }`}>
                                {editFormData.autore === authorName && (
                                  <FiCheck className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <span className="text-sm text-zinc-800 dark:text-zinc-200">{authorName}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                            Nessun autore disponibile
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Participants dropdown */}
                <div className="mb-4 relative" ref={participantsDropdownRef}>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Partecipanti</label>
                  <div className="relative">
                    <div 
                      className="flex items-center w-full p-3 bg-white/5 border border-white/20 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none cursor-pointer"
                      onClick={() => setShowParticipantsDropdown(!showParticipantsDropdown)}
                    >
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                        <FiUsers className="h-5 w-5" />
                      </div>
                      <div className="pl-10 flex-grow truncate">
                        {participants.length > 0 
                          ? participants.join(", ") 
                          : "Aggiungi partecipanti all'articolo"}
                      </div>
                      <FiChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${showParticipantsDropdown ? 'rotate-180' : ''}`} />
                    </div>
                    
                    {/* Dropdown for participant management */}
                    {showParticipantsDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 max-h-60 overflow-auto animate-fade-in">
                        {/* Form to add new participants */}
                        <div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newParticipant}
                              onChange={(e) => setNewParticipant(e.target.value)}
                              placeholder="Nome del partecipante"
                              className="flex-1 p-2 bg-white/5 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddParticipant();
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddParticipant();
                              }}
                              className="cursor-pointer px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                            >
                              <FiPlus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* List of added participants */}
                        <div className="py-1">
                          {participants.length > 0 ? (
                            participants.map((participant, index) => (
                              <div 
                                key={index}
                                className="flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                              >
                                <span className="text-sm text-zinc-800 dark:text-zinc-200">{participant}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveParticipant(participant);
                                  }}
                                  className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                                  title="Rimuovi partecipante"
                                >
                                  <FiTrash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                              Nessun partecipante aggiunto
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Categorie <span className="text-xs text-zinc-500">({editFormData.tag.split(',').filter(t => t.trim()).length}/3)</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 bg-white/5 border border-white/20 rounded-xl">
                  {availableCategories.map((category) => {
                    const isSelected = editFormData.tag
                      .split(',')
                      .map(tag => tag.trim())
                      .includes(category);
                    
                    return (
                      <div 
                        key={category}
                        onClick={() => handleTagChange(category)}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-blue-500/20 border border-blue-500/30' 
                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className={`flex-shrink-0 h-4 w-4 rounded border ${
                          isSelected 
                            ? 'bg-blue-500 border-blue-500 flex items-center justify-center' 
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {isSelected && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-zinc-800 dark:text-zinc-200">
                          {category}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-zinc-500">Puoi selezionare massimo 3 categorie</p>
              </div>

              {/* Visibilità */}
              <div className="flex items-center justify-between p-4 bg-white/5 dark:bg-zinc-800/20 rounded-xl border border-white/10 dark:border-zinc-700/50">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    Visibilità articolo
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {editFormData.isPrivate 
                      ? "Solo gli utenti registrati potranno vedere questo articolo" 
                      : "L'articolo sarà visibile a tutti"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditFormData({...editFormData, isPrivate: !editFormData.isPrivate})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 cursor-pointer focus:outline-none
                    ${editFormData.isPrivate 
                      ? 'bg-amber-500' 
                      : 'bg-zinc-300 dark:bg-zinc-600'}`}
                >
                  <span className="sr-only">
                    Toggle article visibility
                  </span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300
                      ${editFormData.isPrivate ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setEditingArticle(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors duration-200"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200"
                >
                  Salva Modifiche
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Main content with enhanced parallax effects */}
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div 
          className="text-center mb-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{ y: titleY }}
        >
          <motion.h1 
            className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            style={{ scale: titleScale }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Gestione Articoli
          </motion.h1>
          <motion.p 
            className="mt-3 text-zinc-600 dark:text-zinc-300 text-sm sm:text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Visualizza, modifica ed elimina gli articoli pubblicati
          </motion.p>
        </motion.div>
        
        {/* Search bar with animation */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          style={{ y: searchBarY }}
          className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl shadow-xl p-4 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="w-full">
              <motion.input
                whileFocus={{ scale: 1.02, boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.5)" }}
                type="text"
                placeholder="Cerca articoli..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
              />
            </div>
          </div>
        </motion.div>
        
        {/* Table with enhanced parallax shadow effect */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          style={{ 
            boxShadow: tableBoxShadow,
            y: tableY,
            opacity: tableOpacity
          }}
          className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl p-4 overflow-x-auto max-h-[70vh] overflow-y-auto transition-all duration-500"
        >
          {filteredArticles.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="p-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400">Immagine</th>
                  <th 
                    className="p-3 text-left text-sm font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer hover:text-blue-500 dark:hover:text-blue-400"
                    onClick={() => handleSort('titolo')}
                  >
                    <motion.div whileHover={{ x: 3 }} className="inline-flex items-center">
                      Titolo {sortBy === 'titolo' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </motion.div>
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
                  <th className="p-3 text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">Prestazioni</th>
                  <th className="p-3 text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.slice(0, displayedArticles).map((article, index) => (
                  <motion.tr 
                    key={article.uuid} 
                    className="border-b border-white/10 hover:bg-white/5 dark:hover:bg-zinc-800/40 transition-colors duration-200"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.4, 
                      delay: 0.9 + (index * 0.05),
                      ease: "easeOut"
                    }}
                    whileHover={{ 
                      backgroundColor: "rgba(255, 255, 255, 0.07)",
                      transition: { duration: 0.1 } 
                    }}
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
                      {article.status === 'scheduled' && article.scheduleDate && (
                        <div className="mt-1 flex items-center">
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
                            Programmato: {formatDate(article.scheduleDate)}
                          </span>
                        </div>
                      )}
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
                    
                    {/* Statistiche riprogettate per migliore usabilità e semantica dei colori */}
                    <td className="p-3">
                      <div className="flex flex-col space-y-3 w-full max-w-[140px] mx-auto bg-white/10 dark:bg-zinc-800/30 p-2.5 rounded-xl shadow-sm border border-white/20 dark:border-zinc-700/40">
                        {/* Indicatore di performance principale */}
                        <div className="flex items-center justify-between">
                          <FiTrendingUp
                            className={`h-4 w-4 ${
                              calculatePerformanceScore(article) >= 100 ? "text-green-500 dark:text-green-600" :
                              calculatePerformanceScore(article) >= 70 ? "text-yellow-500 dark:text-yellow-600" :
                              "text-red-500 dark:text-red-600"
                            }`}
                          />
                          <div 
                            className={`px-2 py-0.5 rounded-full text-xs font-bold tabular-nums text-white ${
                              calculatePerformanceScore(article) >= 100 ? "bg-green-500 dark:bg-green-600" :
                              calculatePerformanceScore(article) >= 70 ? "bg-yellow-500 dark:bg-yellow-600" :
                              "bg-red-500 dark:bg-red-600"
                            }`}
                          >
                            {calculatePerformanceScore(article)}%
                          </div>
                        </div>
                        
                        {/* Barra di performance con semantica dei colori */}
                        <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              calculatePerformanceScore(article) >= 100 ? "bg-green-500 dark:bg-green-600" :
                              calculatePerformanceScore(article) >= 70 ? "bg-yellow-500 dark:bg-yellow-600" :
                              "bg-red-500 dark:bg-red-600"
                            }`}
                            style={{ width: `${Math.min(calculatePerformanceScore(article), 100)}%` }}
                          ></div>
                        </div>
                        
                        {/* Metriche singole in layout più usabile */}
                        <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-zinc-200 dark:border-zinc-700/50">
                          {/* Like */}
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              <FiHeart className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                              <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{article.upvote || 0}</span>
                            </div>
                            <div className="w-8 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-rose-500 rounded-full"
                                style={{ 
                                  width: articles.length > 0 
                                    ? `${Math.min(((article.upvote || 0) / articles.reduce((max, a) => Math.max(max, a.upvote || 0), 1)) * 100, 100)}%`
                                    : '0%' 
                                }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* Visualizzazioni */}
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              <FiEye className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                              <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{article.view || 0}</span>
                            </div>
                            <div className="w-8 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full"
                                style={{ 
                                  width: articles.length > 0 
                                    ? `${Math.min(((article.view || 0) / articles.reduce((max, a) => Math.max(max, a.view || 0), 1)) * 100, 100)}%` 
                                    : '0%' 
                                }}
                              ></div>
                            </div>
                          </div>
                          
                          {/* Condivisioni */}
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center gap-1">
                              <FiShare2 className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
                              <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{article.shared || 0}</span>
                            </div>
                            <div className="w-8 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-500 rounded-full"
                                style={{ 
                                  width: articles.length > 0 
                                    ? `${Math.min(((article.shared || 0) / articles.reduce((max, a) => Math.max(max, a.shared || 0), 1)) * 100, 100)}%` 
                                    : '0%' 
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Azioni */}
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        {article.status === 'scheduled' && (
                          <button 
                            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400 transition-colors duration-200 cursor-pointer"
                            title="Programmato per pubblicazione"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                        {isSuperior && (
                          <>
                            <button 
                              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200 cursor-pointer"
                              onClick={() => {
                                setEditingArticle(article);
                                setEditFormData({
                                  titolo: article.titolo,
                                  contenuto: article.contenuto,
                                  tag: article.tag,
                                  autore: article.autore,
                                  partecipanti: article.partecipanti || '',
                                  isPrivate: article.isPrivate,
                                  immagine: article.immagine,
                                  additionalLinks: article.additionalLinks || [],
                                  secondaryNotes: article.secondaryNotes || [],
                                  newNoteContent: '',
                                  newLinkUrl: '',
                                  newLinkLabel: ''
                                });
                              }}
                              title="Modifica articolo"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button 
                              className={`p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 transition-colors duration-200 cursor-pointer ${
                                article.status === 'suspended'
                                  ? 'text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
                                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                              }`}
                              onClick={() => toggleArticleStatus(article)}
                              title={article.status === 'suspended' ? "Riattiva articolo" : "Sospendi articolo"}
                            >
                              {article.status === 'suspended' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </button>
                            <button 
                              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200 cursor-pointer"
                              onClick={() => setDeleteConfirm(article.uuid)}
                              title="Elimina articolo"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <motion.div 
              className="py-12 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div 
                animate={{ 
                  y: [0, -10, 0],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity,
                  repeatType: "reverse" 
                }}
              >
                <FiAlertCircle className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4" />
              </motion.div>
              <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">Nessun articolo trovato</h3>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                {searchTerm ? 'Prova a modificare i criteri di ricerca' : 'Non ci sono articoli pubblicati'}
              </p>
            </motion.div>
          )}
        </motion.div>
        
        {/* Move the Load More button inside the scrollable container */}
        {filteredArticles.length > displayedArticles && (
          <div className="flex justify-center mt-6 sticky bottom-4 z-10">
            <Button 
              onClick={loadMoreArticles}
              className="bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 px-5 py-2 rounded-xl shadow-lg"
            >
              Mostra altri 5 articoli
            </Button>
          </div>
        )}
      </div>
    </motion.main>
  )
} 