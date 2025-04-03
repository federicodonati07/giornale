"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { FiArrowLeft, FiTrash2, FiEye, FiHeart, FiShare2, FiAlertCircle, FiX, FiTrendingUp, FiUsers, FiChevronDown, FiPlus, FiUser, FiCheck, FiUpload } from "react-icons/fi"
import { getStorage, ref as storageRef, deleteObject, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage"
import { ref, get, remove, update } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { FirebaseError } from "firebase/app"
import { auth, db, app } from "../../firebase"
import { motion, useScroll, useTransform } from "framer-motion"
import { v4 as uuidv4 } from 'uuid'

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
  partecipanti?: string
  isPrivate: boolean
  additionalLinks?: { label: string; url: string }[]
  scheduleDate?: string
  secondaryNotes?: { id: string; content: string }[]
  relatedImages?: string[]
  sensitiveTags?: string[]
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
    additionalLinks: [] as { label: string; url: string }[],
    secondaryNotes: [] as { id: string, content: string }[],
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
  // Aggiungi questo state per gestire la conferma di revisione
  const [revisionConfirm, setRevisionConfirm] = useState<string | null>(null)
  // Aggiungi questi stati per la gestione della selezione multipla e filtri
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [showSuspended, setShowSuspended] = useState<boolean>(false);
  const [bulkActionConfirm, setBulkActionConfirm] = useState<{type: 'delete' | 'suspend' | 'activate' | 'revision', count: number} | null>(null);
  
  // Aggiungi questi state per gestire le immagini correlate
  const [relatedFiles, setRelatedFiles] = useState<(File | null)[]>([null, null, null]);
  const [relatedPreviews, setRelatedPreviews] = useState<(string | null)[]>([null, null, null]);
  const [relatedSensitiveFlags, setRelatedSensitiveFlags] = useState<boolean[]>([false, false, false]);
  const relatedFileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);

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

  // Aggiungi questo useEffect per creare lo stile delle scrollbar nascoste
  useEffect(() => {
    // Crea un elemento di stile per nascondere le scrollbar
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .hidden-scrollbar {
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
      }
      .hidden-scrollbar::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
      }
    `;
    
    document.head.appendChild(styleElement);
    
    // Cleanup quando il componente viene smontato
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

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
    "ITALIA",
    "STORIA"
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
      
      // Elimina le immagini correlate se esistono
      if (articleToDelete.relatedImages && articleToDelete.relatedImages.length > 0) {
        try {
          const storage = getStorage(app);
          
          // Tenta di eliminare la cartella che contiene le immagini correlate
          for (const relatedImageUrl of articleToDelete.relatedImages) {
            if (relatedImageUrl && relatedImageUrl.includes('firebasestorage.googleapis.com')) {
              try {
                const url = new URL(relatedImageUrl);
                const imagePath = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
                const imageRef = storageRef(storage, imagePath);
                
                await deleteObject(imageRef);
                console.log("Immagine correlata eliminata con successo:", imagePath);
              } catch (relatedImageError: FirebaseError | unknown) {
                if (relatedImageError instanceof FirebaseError && relatedImageError.code === 'storage/object-not-found') {
                  console.log("L'immagine correlata non esiste più nello storage");
                } else {
                  console.error("Errore durante l'eliminazione dell'immagine correlata:", relatedImageError);
                }
              }
            }
          }
        } catch (error) {
          console.error("Errore durante l'eliminazione delle immagini correlate:", error);
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

  // Format the date string to a more readable format
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { 
        day: 'numeric',
        month: 'short',
      year: 'numeric',
      hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString; // Return the original string if parsing fails
    }
  };

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
    // Filtra in base allo stato
    (article.status !== 'revision') &&
    // Mostra articoli sospesi solo se il filtro è attivo
    (showSuspended ? article.status === 'suspended' : true)
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
      // Carica l'immagine principale se è stata modificata
      const mainImageUrl = editFormData.immagine;
      
      // Carica le immagini correlate che sono state aggiunte o modificate
      let relatedImageUrls: string[] = [];
      const storage = getStorage(app);
      
      // Tiene traccia di quali indici sono stati modificati per successivamente eliminare le vecchie immagini
      const modifiedIndices: number[] = [];
      
      // Per le immagini correlate già esistenti che non sono state modificate
      if (editingArticle.relatedImages) {
        relatedPreviews.forEach((preview, index) => {
          // Se l'anteprima corrisponde a un'immagine esistente e non è stata modificata
          if (preview && !relatedFiles[index] && editingArticle.relatedImages && 
              index < editingArticle.relatedImages.length) {
            relatedImageUrls[index] = editingArticle.relatedImages[index];
          } else if (relatedFiles[index]) {
            // Se c'è un nuovo file, segna questo indice come modificato
            modifiedIndices.push(index);
          }
        });
      } else {
        // Se non ci sono immagini correlate esistenti, tutte le nuove sono modifiche
        relatedFiles.forEach((file, index) => {
          if (file) {
            modifiedIndices.push(index);
          }
        });
      }
      
      // Elimina le vecchie immagini per gli indici modificati prima di caricare le nuove
      if (editingArticle.relatedImages && modifiedIndices.length > 0) {
        for (const index of modifiedIndices) {
          if (index < editingArticle.relatedImages.length && editingArticle.relatedImages[index]) {
            try {
              const oldImageUrl = new URL(editingArticle.relatedImages[index]);
              const oldImagePath = decodeURIComponent(oldImageUrl.pathname.split('/o/')[1].split('?')[0]);
              const oldImageRef = storageRef(storage, oldImagePath);
              
              await deleteObject(oldImageRef);
              console.log(`Immagine correlata precedente eliminata con successo: related_${index + 1}`);
            } catch (error) {
              console.error(`Errore durante l'eliminazione dell'immagine correlata precedente related_${index + 1}:`, error);
              // Continuiamo comunque con il caricamento anche se l'eliminazione fallisce
            }
          }
        }
      }
      
      // Carica le nuove immagini correlate
      if (relatedFiles.some(file => file !== null)) {
        try {
          const newUrls = await uploadRelatedImages(editingArticle.uuid);
          
          // Combina le URL delle immagini esistenti e le nuove
          relatedFiles.forEach((file, index) => {
            if (file) {
              // Se c'è un file nuovo, usa l'URL appena caricata
              const urlIndex = relatedFiles.slice(0, index + 1).filter(f => f !== null).length - 1;
              if (urlIndex >= 0 && urlIndex < newUrls.length) {
                relatedImageUrls[index] = newUrls[urlIndex];
              }
            } else if (!relatedImageUrls[index] && relatedPreviews[index]) {
              // Se non c'è un file nuovo ma c'è un'anteprima, potrebbe essere un'immagine esistente
              relatedImageUrls[index] = relatedPreviews[index]!;
            }
          });
        } catch (error) {
          console.error("Errore durante il caricamento delle immagini correlate:", error);
          showNotification("error", "Si è verificato un errore durante il caricamento delle immagini correlate");
        }
      }
      
      // Rimuovi i null dall'array di URL
      relatedImageUrls = relatedImageUrls.filter(url => url);
      
      // Crea l'array di tag per le immagini sensibili
      const sensitiveTags: string[] = [];
      relatedSensitiveFlags.forEach((isSensitive, index) => {
        if (isSensitive && (relatedFiles[index] || relatedPreviews[index])) {
          sensitiveTags.push(`related_${index + 1}`);
        }
      });
      
      const articleRef = ref(db, `articoli/${editingArticle.uuid}`);
      await update(articleRef, {
        titolo: editFormData.titolo,
        contenuto: editFormData.contenuto,
        tag: editFormData.tag.split(',').map(t => t.trim()).join(', '),
        autore: editFormData.autore,
        partecipanti: editFormData.partecipanti,
        isPrivate: editFormData.isPrivate,
        immagine: mainImageUrl,
        additionalLinks: editFormData.additionalLinks,
        secondaryNotes: editFormData.secondaryNotes,
        relatedImages: relatedImageUrls.length > 0 ? relatedImageUrls : null,
        sensitiveTags: sensitiveTags.length > 0 ? sensitiveTags : null
      });
      
      // Aggiorna la lista degli articoli
      setArticles(articles.map(article => 
        article.uuid === editingArticle.uuid 
          ? { 
              ...article, 
              ...editFormData,
              tag: editFormData.tag.split(',').map(t => t.trim()).join(', '),
              relatedImages: relatedImageUrls.length > 0 ? relatedImageUrls : undefined,
              sensitiveTags: sensitiveTags.length > 0 ? sensitiveTags : undefined
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
    if (displayedArticles < filteredArticles.length) {
      // Se ci sono più articoli da mostrare, li mostriamo tutti
      setDisplayedArticles(filteredArticles.length);
    } else {
      // Se stiamo già mostrando tutti gli articoli, torniamo a mostrarne solo 5
      setDisplayedArticles(5);
    }
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
      
      // Reset related images state
      setRelatedFiles([null, null, null]);
      setRelatedPreviews([null, null, null]);
      setRelatedSensitiveFlags([false, false, false]);
      
      // Load existing related images
      if (editingArticle.relatedImages && editingArticle.relatedImages.length > 0) {
        const newPreviews = [...relatedPreviews];
        
        editingArticle.relatedImages.forEach((url, index) => {
          if (index < 3) { // Ensure we only load up to 3 images
            newPreviews[index] = url;
          }
        });
        
        setRelatedPreviews(newPreviews);
        
        // Set sensitive flags based on sensitiveTags
        if (editingArticle.sensitiveTags) {
          const newFlags = [...relatedSensitiveFlags];
          
          editingArticle.sensitiveTags.forEach(tag => {
            if (tag.startsWith('related_')) {
              const index = parseInt(tag.split('_')[1]) - 1;
              if (index >= 0 && index < 3) {
                newFlags[index] = true;
              }
            }
          });
          
          setRelatedSensitiveFlags(newFlags);
        }
      }
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
        
        // Ordina gli autori alfabeticamente
        authorsData.sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
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

  // Aggiungi questa funzione per mandare l'articolo in revisione
  const sendToRevision = async (uuid: string) => {
    try {
      const articleRef = ref(db, `articoli/${uuid}`);
      await update(articleRef, {
        status: 'revision'
      });
      
      // Aggiorna la lista degli articoli
      setArticles(articles.map(article => 
        article.uuid === uuid 
          ? { ...article, status: 'revision' }
          : article
      ));
      
      showNotification("success", "Articolo inviato in revisione");
      setRevisionConfirm(null);
    } catch (error) {
      console.error("Errore durante l'invio in revisione:", error);
      showNotification("error", "Errore durante l'invio in revisione dell'articolo");
    }
  };

  // Aggiungi queste funzioni per gestire la selezione
  const toggleSelectArticle = (uuid: string) => {
    setSelectedArticles(prev => 
      prev.includes(uuid) 
        ? prev.filter(id => id !== uuid)
        : [...prev, uuid]
    );
  };

  const selectAllDisplayedArticles = () => {
    if (selectedArticles.length === filteredArticles.slice(0, displayedArticles).length) {
      // Se tutti sono già selezionati, deseleziona tutti
      setSelectedArticles([]);
    } else {
      // Altrimenti seleziona tutti
      setSelectedArticles(filteredArticles.slice(0, displayedArticles).map(a => a.uuid));
    }
  };

  // Aggiungi queste funzioni per determinare lo stato degli articoli selezionati
  const getSelectedArticlesStatus = () => {
    const selectedArticlesData = articles.filter(article => selectedArticles.includes(article.uuid));
    const suspendedCount = selectedArticlesData.filter(article => article.status === 'suspended').length;
    const activeCount = selectedArticlesData.length - suspendedCount;

    // Tutti sospesi
    if (suspendedCount === selectedArticlesData.length) {
      return 'all-suspended';
    }
    // Tutti attivi
    if (activeCount === selectedArticlesData.length) {
      return 'all-active';
    }
    // Misti
    return 'mixed';
  };

  // Aggiorna la funzione confirmBulkAction per gestire l'attivazione/sospensione in modo intelligente
  const confirmBulkAction = (type: 'delete' | 'suspend' | 'activate' | 'revision') => {
    // Se il tipo è suspend o activate, adatta l'azione in base allo stato corrente
    if (type === 'suspend' || type === 'activate') {
      const status = getSelectedArticlesStatus();
      
      // Se tutti gli articoli sono già sospesi e si vuole sospendere, non fare nulla
      if (status === 'all-suspended' && type === 'suspend') {
        showNotification("info", "Tutti gli articoli selezionati sono già sospesi");
        return;
      }
      
      // Se tutti gli articoli sono già attivi e si vuole attivare, non fare nulla
      if (status === 'all-active' && type === 'activate') {
        showNotification("info", "Tutti gli articoli selezionati sono già attivi");
        return;
      }
      
      // Per lo stato misto, usa il tipo specificato (suspend o activate)
    }
    
    setBulkActionConfirm({ 
      type, 
      count: selectedArticles.length 
    });
  };

  // Modifica la logica di executeBulkAction per gestire selettivamente gli articoli
  const executeBulkAction = async () => {
    if (!bulkActionConfirm) return;
    
    try {
      setLoading(true);
      const status = getSelectedArticlesStatus();
      const articlesToProcess = [...selectedArticles];
      
      // Se l'azione è suspend e lo stato è misto, processa solo gli articoli attivi
      if (bulkActionConfirm.type === 'suspend' && status === 'mixed') {
        const activeArticles = articles
          .filter(a => selectedArticles.includes(a.uuid) && a.status !== 'suspended')
          .map(a => a.uuid);
        articlesToProcess.length = 0;
        articlesToProcess.push(...activeArticles);
      }
      
      // Se l'azione è activate e lo stato è misto, processa solo gli articoli sospesi
      if (bulkActionConfirm.type === 'activate' && status === 'mixed') {
        const suspendedArticles = articles
          .filter(a => selectedArticles.includes(a.uuid) && a.status === 'suspended')
          .map(a => a.uuid);
        articlesToProcess.length = 0;
        articlesToProcess.push(...suspendedArticles);
      }
      
      for (const uuid of articlesToProcess) {
        const articleRef = ref(db, `articoli/${uuid}`);
        
        switch (bulkActionConfirm.type) {
          case 'delete':
            // Trova l'articolo per l'immagine
            const articleToDelete = articles.find(a => a.uuid === uuid);
            if (articleToDelete?.immagine && articleToDelete.immagine.includes('firebasestorage.googleapis.com')) {
              try {
                const storage = getStorage(app);
                const imageUrl = new URL(articleToDelete.immagine);
                const imagePath = decodeURIComponent(imageUrl.pathname.split('/o/')[1].split('?')[0]);
                const imageRef = storageRef(storage, imagePath);
                await deleteObject(imageRef);
              } catch (imageError) {
                console.error("Errore durante l'eliminazione dell'immagine:", imageError);
              }
            }
            
            // Elimina le immagini correlate se esistono
            if (articleToDelete?.relatedImages && articleToDelete.relatedImages.length > 0) {
              try {
                const storage = getStorage(app);
                
                // Tenta di eliminare le immagini correlate
                for (const relatedImageUrl of articleToDelete.relatedImages) {
                  if (relatedImageUrl && relatedImageUrl.includes('firebasestorage.googleapis.com')) {
                    try {
                      const url = new URL(relatedImageUrl);
                      const imagePath = decodeURIComponent(url.pathname.split('/o/')[1].split('?')[0]);
                      const imageRef = storageRef(storage, imagePath);
                      
                      await deleteObject(imageRef);
                      console.log("Immagine correlata eliminata con successo:", imagePath);
                    } catch (relatedImageError: FirebaseError | unknown) {
                      if (relatedImageError instanceof FirebaseError && relatedImageError.code === 'storage/object-not-found') {
                        console.log("L'immagine correlata non esiste più nello storage");
                      } else {
                        console.error("Errore durante l'eliminazione dell'immagine correlata:", relatedImageError);
                      }
                    }
                  }
                }
              } catch (error) {
                console.error("Errore durante l'eliminazione delle immagini correlate:", error);
              }
            }
            
            await remove(articleRef);
            break;
            
          case 'suspend':
            await update(articleRef, { status: 'suspended' });
            break;
            
          case 'activate':
            await update(articleRef, { status: 'accepted' });
            break;
            
          case 'revision':
            await update(articleRef, { status: 'revision' });
            break;
        }
      }
      
      // Aggiorna la lista degli articoli
      await fetchArticles();
      
      // Mostra notifica di successo con il conteggio corretto
      const actionMessages = {
        delete: "eliminati",
        suspend: "sospesi",
        activate: "riattivati",
        revision: "inviati in revisione"
      };
      
      showNotification(
        "success", 
        `${articlesToProcess.length} articoli ${actionMessages[bulkActionConfirm.type]} con successo`
      );
      
      // Resetta la selezione
      setSelectedArticles([]);
      setBulkActionConfirm(null);
    } catch (error) {
      console.error("Errore durante l'esecuzione dell'azione di massa:", error);
      showNotification("error", "Si è verificato un errore durante l'esecuzione dell'azione");
    } finally {
      setLoading(false);
    }
  };

  // Aggiungi la funzione per gestire il caricamento delle immagini correlate
  const handleRelatedFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    // Aggiorna l'array di file correlati
    const newRelatedFiles = [...relatedFiles];
    newRelatedFiles[index] = file;
    setRelatedFiles(newRelatedFiles);
    
    if (file) {
      // Crea un URL per l'anteprima
      const previewURL = URL.createObjectURL(file);
      
      // Aggiorna l'array di anteprime
      const newRelatedPreviews = [...relatedPreviews];
      newRelatedPreviews[index] = previewURL;
      setRelatedPreviews(newRelatedPreviews);
    } else {
      // Rimuovi l'anteprima se il file è stato rimosso
      const newRelatedPreviews = [...relatedPreviews];
      newRelatedPreviews[index] = null;
      setRelatedPreviews(newRelatedPreviews);
    }
  };
  
  // Rimuovi immagine correlata
  const removeRelatedImage = (index: number) => {
    if (!editingArticle) return;
    
    const newRelatedFiles = [...relatedFiles];
    const newRelatedPreviews = [...relatedPreviews];
    
    // Se c'è un'immagine correlata esistente, eliminala dallo storage di Firebase
    if (editingArticle.relatedImages && 
        index < editingArticle.relatedImages.length && 
        editingArticle.relatedImages[index] && 
        !relatedFiles[index]) {
      try {
        const storage = getStorage(app);
        const oldImageUrl = new URL(editingArticle.relatedImages[index]);
        const oldImagePath = decodeURIComponent(oldImageUrl.pathname.split('/o/')[1].split('?')[0]);
        const oldImageRef = storageRef(storage, oldImagePath);
        
        // Elimina l'immagine da Firebase Storage
        deleteObject(oldImageRef).then(() => {
          console.log(`Immagine correlata eliminata con successo dallo storage: related_${index + 1}`);
        }).catch((error) => {
          console.error(`Errore durante l'eliminazione dell'immagine correlata dallo storage: related_${index + 1}`, error);
        });
      } catch (error) {
        console.error(`Errore durante l'eliminazione dell'immagine correlata: related_${index + 1}`, error);
      }
    }
    
    // Imposta il file e l'anteprima a null
    newRelatedFiles[index] = null;
    newRelatedPreviews[index] = null;
    
    setRelatedFiles(newRelatedFiles);
    setRelatedPreviews(newRelatedPreviews);
    
    // Resetta anche l'input file
    if (relatedFileInputRefs.current[index]) {
      relatedFileInputRefs.current[index]!.value = "";
    }
  };
  
  // Funzione per caricare le immagini correlate su Firebase Storage
  const uploadRelatedImages = async (uuid: string): Promise<string[]> => {
    const uploadPromises: Promise<string>[] = [];
    const storage = getStorage(app);
    
    // Per ogni immagine correlata, crea un promise di caricamento
    relatedFiles.forEach((file, index) => {
      if (file) {
        const fileExtension = file.name.split('.').pop();
        const fileRef = storageRef(storage, `articoli/related/${uuid}/related_${index + 1}.${fileExtension}`);
        
        const uploadPromise = new Promise<string>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(fileRef, file);
          
          uploadTask.on(
            'state_changed',
            () => {
              // Il progresso può essere gestito qui se necessario
            },
            (error) => {
              console.error(`Errore durante il caricamento dell'immagine correlata ${index + 1}:`, error);
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              } catch (error) {
                reject(error);
              }
            }
          );
        });
        
        uploadPromises.push(uploadPromise);
      }
    });
    
    // Attendi che tutte le immagini correlate siano caricate
    const urls = await Promise.all(uploadPromises);
    return urls;
  };
  
  // Modifica la funzione per gestire il toggle del flag sensibile
  const toggleSensitiveFlag = (index: number) => {
    const newFlags = [...relatedSensitiveFlags];
    newFlags[index] = !newFlags[index];
    setRelatedSensitiveFlags(newFlags);
  };

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
                <FiTrash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-serif font-bold text-zinc-900 dark:text-zinc-50 mb-2">Conferma eliminazione</h2>
              <p className="text-zinc-600 dark:text-zinc-300">Sei sicuro di voler eliminare questo articolo? Questa azione non può essere annullata.</p>
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
              {/* Titolo */}
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

              {/* Autore */}
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
                  
                  {/* Dropdown for author selection */}
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

              {/* Tag */}
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

              {/* Partecipanti */}
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
                                className="text-zinc-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
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

              {/* Contenuto */}
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

              {/* Immagini correlate */}
              <div className="mt-6">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Immagini correlate <span className="text-xs text-zinc-500">(max 3 immagini)</span>
                  </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="relative">
                  <input
                        type="file"
                        ref={el => { relatedFileInputRefs.current[index] = el }}
                        accept="image/*"
                        onChange={(e) => handleRelatedFileChange(index, e)}
                        className="hidden"
                      />
                      
                      {relatedPreviews[index] ? (
                        <div className="relative h-48 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-md group">
                          <img 
                            src={relatedPreviews[index]!} 
                            alt={`Immagine correlata ${index + 1}`} 
                            className={`w-full h-full object-cover transition-all duration-300 ${relatedSensitiveFlags[index] ? 'blur-sm group-hover:blur-none' : ''}`}
                          />
                          
                          {/* Gradient overlay for better text readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-100 pointer-events-none"></div>
                          
                          {/* Buttons for image management */}
                          <div className="absolute top-2 right-2 flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRelatedImage(index);
                              }}
                              className="bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors cursor-pointer"
                              title="Rimuovi immagine"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
              </div>

                          {/* Modern toggle switch for sensitive content */}
                          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-black/40 text-white flex items-center justify-between transition-all duration-300">
                            <span className="text-xs font-medium">Immagine {index + 1}</span>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-xs">Sensibile</span>
                <button
                  type="button"
                                onClick={() => toggleSensitiveFlag(index)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                                  relatedSensitiveFlags[index] ? 'bg-rose-500' : 'bg-zinc-300 dark:bg-zinc-600'
                                }`}
                              >
                  <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                    relatedSensitiveFlags[index] ? 'translate-x-5' : 'translate-x-1'
                                  }`}
                  />
                </button>
                            </div>
                          </div>
                          
                          {/* Badge for sensitive content */}
                          {relatedSensitiveFlags[index] && (
                            <div className="absolute top-2 left-2 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded shadow-md">
                              SENSIBILE
                            </div>
                          )}
                        </div>
                      ) : (
                        // Mostra l'area di caricamento se non c'è un'immagine
                        <div 
                          onClick={() => relatedFileInputRefs.current[index]?.click()}
                          className="h-48 p-6 bg-white/5 dark:bg-zinc-800/20 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl hover:border-amber-500 dark:hover:border-amber-400 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center"
                        >
                          <div className="mx-auto h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center mb-3">
                            <FiUpload className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                          </div>
                          <p className="text-sm text-zinc-800 dark:text-zinc-300 font-medium text-center">Immagine correlata {index + 1}</p>
                          <p className="text-xs text-zinc-500 mt-1 text-center">Clicca per caricare</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <p className="mt-2 text-xs text-zinc-500">
                  Le immagini correlate verranno mostrate nella galleria dell&apos;articolo
                </p>
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
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 cursor-pointer"
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
        
        {/* Search bar with animation - now with sticky positioning */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          style={{ y: searchBarY }}
          className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl shadow-xl p-4 mb-6 sticky top-0 z-50"
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
          
          {/* Filtri e Azioni di massa */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            {/* Filtri */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSuspended(!showSuspended)}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${
                    showSuspended
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/40'
                      : 'bg-white/10 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-white/20 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {showSuspended ? "Tutti gli articoli" : "Solo sospesi"}
                </button>
              </div>
              
              {/* Mostra qui il pulsante "Carica altri/Nascondi" con testo adeguato */}
              {filteredArticles.length > 5 && (
                <button
                  onClick={loadMoreArticles}
                  className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform ${displayedArticles >= filteredArticles.length ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {displayedArticles >= filteredArticles.length 
                    ? `Nascondi (${displayedArticles-5}/${filteredArticles.length-5})`
                    : `Mostra altri ${Math.min(filteredArticles.length - displayedArticles, filteredArticles.length - 5)} articoli (${displayedArticles}/${filteredArticles.length})`
                  }
                </button>
              )}
            </div>
            
            {/* Azioni di massa */}
            {selectedArticles.length > 0 && (
              <div className="flex items-center gap-2">
                {getSelectedArticlesStatus() !== 'all-suspended' && (
                  <button
                    onClick={() => confirmBulkAction('suspend')}
                    className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {getSelectedArticlesStatus() === 'mixed' ? 'Sospendi attivi' : 'Sospendi'}
                  </button>
                )}
                
                {getSelectedArticlesStatus() !== 'all-active' && (
                  <button
                    onClick={() => confirmBulkAction('activate')}
                    className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/40 transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                    </svg>
                    {getSelectedArticlesStatus() === 'mixed' ? 'Riattiva sospesi' : 'Riattiva'}
                  </button>
                )}
                
                <button
                  onClick={() => confirmBulkAction('delete')}
                  className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors cursor-pointer"
                >
                  <FiTrash2 className="h-4 w-4" />
                  Elimina
                </button>
              </div>
            )}
          </div>
        </motion.div>
        
        {/* Articles table with motion */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          style={{ 
            boxShadow: tableBoxShadow,
            y: tableY,
            opacity: tableOpacity
          }}
          className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl p-4 overflow-hidden transition-all duration-500"
        >
          {filteredArticles.length > 0 ? (
            <div className="overflow-x-auto hidden-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/20">
                    {/* Checkbox per selezionare tutti */}
                    <th className="p-3 w-8">
                      <div className="flex items-center justify-center">
                        <div 
                          className={`h-5 w-5 rounded border ${
                            selectedArticles.length === filteredArticles.slice(0, displayedArticles).length && filteredArticles.length > 0
                              ? 'bg-blue-500 border-blue-500 flex items-center justify-center' 
                              : 'border-zinc-300 dark:border-zinc-600 cursor-pointer hover:border-blue-500'
                          }`}
                          onClick={selectAllDisplayedArticles}
                        >
                          {selectedArticles.length === filteredArticles.slice(0, displayedArticles).length && filteredArticles.length > 0 && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </th>
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
                      className={`border-b border-white/10 transition-colors duration-300 ${
                        selectedArticles.includes(article.uuid)
                          ? 'bg-blue-500/5 dark:bg-blue-800/10 hover:bg-blue-500/10 dark:hover:bg-blue-800/20'
                          : 'hover:bg-white/10 dark:hover:bg-zinc-800/50'
                      }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.4, 
                      delay: 0.9 + (index * 0.05),
                      ease: "easeOut"
                    }}
                    whileHover={{ 
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                        transition: { duration: 0.2 } 
                      }}
                    >
                      {/* Checkbox per selezionare */}
                      <td className="p-3 text-center">
                        <div 
                          className={`h-5 w-5 rounded border mx-auto cursor-pointer ${
                            selectedArticles.includes(article.uuid)
                              ? 'bg-blue-500 border-blue-500 flex items-center justify-center' 
                              : 'border-zinc-300 dark:border-zinc-600 hover:border-blue-500'
                          }`}
                          onClick={() => toggleSelectArticle(article.uuid)}
                        >
                          {selectedArticles.includes(article.uuid) && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </td>
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
                        {article.status === 'suspended' && (
                          <div className="mt-1 flex items-center">
                            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full">
                              Sospeso
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
                        <div className="flex flex-col p-2 gap-2 bg-white/10 dark:bg-zinc-800/40 rounded-xl border border-white/20 dark:border-zinc-700/40 shadow-sm">
                          {/* Prima riga di pulsanti: stop/via e delete */}
                      <div className="flex justify-center gap-2">
                            {isSuperior && (
                              <>
                          <button 
                                  className={`p-2 rounded-full transition-colors duration-200 cursor-pointer ${
                                    article.status === 'suspended'
                                      ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/40'
                                      : 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/40'
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
                                  className="p-2 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors duration-200 cursor-pointer"
                                  onClick={() => setDeleteConfirm(article.uuid)}
                                  title="Elimina articolo"
                                >
                                  <FiTrash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                          
                          {/* Seconda riga di pulsanti: edit e revision */}
                        {isSuperior && (
                            <div className="flex justify-center gap-2">
                            <button 
                                className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors duration-200 cursor-pointer"
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
                              
                              {/* Pulsante per revisione in viola */}
                            <button 
                                className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors duration-200 cursor-pointer"
                                onClick={() => setRevisionConfirm(article.uuid)}
                                title="Invia in revisione"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </button>
                            </div>
                          )}
                          
                          {/* Indicatore di articolo programmato */}
                          {article.status === 'scheduled' && article.scheduleDate && (
                            <div className="flex justify-center">
                            <button 
                                className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors duration-200 cursor-pointer"
                                title="Programmato per pubblicazione"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                            </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            </div>
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
      </div>
      
      {/* Aggiungi il popup di conferma della revisione dopo il popup di eliminazione */}
      {revisionConfirm && (
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
              <div className="mx-auto w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
          </div>
              <h2 className="text-xl font-serif font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                Conferma invio in revisione
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300">
                Sei sicuro di voler inviare questo articolo in revisione? L&apos;articolo non sarà più visibile fino all&apos;approvazione.
              </p>
            </div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setRevisionConfirm(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors duration-200 cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => sendToRevision(revisionConfirm)}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors duration-200 cursor-pointer"
              >
                Conferma
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      {/* Popup di conferma per le azioni di massa */}
      {bulkActionConfirm && (
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
              {/* Icona in base al tipo di azione */}
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                bulkActionConfirm.type === 'delete' ? 'bg-red-100 dark:bg-red-900/30' :
                bulkActionConfirm.type === 'suspend' ? 'bg-amber-100 dark:bg-amber-900/30' :
                bulkActionConfirm.type === 'activate' ? 'bg-green-100 dark:bg-green-900/30' :
                'bg-purple-100 dark:bg-purple-900/30'
              }`}>
                {bulkActionConfirm.type === 'delete' && (
                  <FiTrash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                )}
                {bulkActionConfirm.type === 'suspend' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {bulkActionConfirm.type === 'activate' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                  </svg>
                )}
                {bulkActionConfirm.type === 'revision' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </div>
              <h2 className="text-xl font-serif font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                {bulkActionConfirm.type === 'delete' && "Conferma eliminazione multipla"}
                {bulkActionConfirm.type === 'suspend' && 
                  (getSelectedArticlesStatus() === 'mixed' 
                    ? "Conferma sospensione articoli attivi" 
                    : "Conferma sospensione multipla")}
                {bulkActionConfirm.type === 'activate' && 
                  (getSelectedArticlesStatus() === 'mixed' 
                    ? "Conferma riattivazione articoli sospesi" 
                    : "Conferma riattivazione multipla")}
                {bulkActionConfirm.type === 'revision' && "Conferma invio in revisione"}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-300">
                {bulkActionConfirm.type === 'delete' && (
                  `Stai per eliminare ${bulkActionConfirm.count} articoli. Questa azione non può essere annullata.`
                )}
                {bulkActionConfirm.type === 'suspend' && (
                  getSelectedArticlesStatus() === 'mixed'
                    ? `Stai per sospendere solo gli articoli attivi tra quelli selezionati. Gli articoli non saranno visibili fino alla riattivazione.`
                    : `Stai per sospendere ${bulkActionConfirm.count} articoli. Gli articoli non saranno visibili fino alla riattivazione.`
                )}
                {bulkActionConfirm.type === 'activate' && (
                  getSelectedArticlesStatus() === 'mixed'
                    ? `Stai per riattivare solo gli articoli sospesi tra quelli selezionati. Gli articoli torneranno ad essere visibili.`
                    : `Stai per riattivare ${bulkActionConfirm.count} articoli. Gli articoli torneranno ad essere visibili.`
                )}
                {bulkActionConfirm.type === 'revision' && (
                  `Stai per inviare ${bulkActionConfirm.count} articoli in revisione. Gli articoli non saranno visibili fino all&apos;approvazione.`
                )}
              </p>
            </div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setBulkActionConfirm(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors duration-200 cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={executeBulkAction}
                className={`px-4 py-2 rounded-xl text-white transition-colors duration-200 cursor-pointer ${
                  bulkActionConfirm.type === 'delete' ? 'bg-red-600 hover:bg-red-700' :
                  bulkActionConfirm.type === 'suspend' ? 'bg-amber-600 hover:bg-amber-700' :
                  bulkActionConfirm.type === 'activate' ? 'bg-green-600 hover:bg-green-700' :
                  'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                Conferma
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      {/* Aggiungi pulsante "Torna in cima" alla fine della lista degli articoli */}
      <div className="flex justify-center mt-8 mb-10">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 dark:bg-zinc-800/30 border border-white/30 dark:border-white/10 shadow-lg backdrop-blur-md hover:bg-white/30 dark:hover:bg-zinc-700/40 transition-all duration-300 text-zinc-800 dark:text-zinc-200 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          Torna in cima
        </button>
      </div>
    </motion.main>
  )
} 