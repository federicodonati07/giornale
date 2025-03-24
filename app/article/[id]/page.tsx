"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { ref, get, update, increment, remove } from "firebase/database"
import { db, auth, app } from "../../firebase"
import { FiHeart, FiShare2, FiEye, FiClock, FiArrowLeft, FiLock, FiCheck, FiX } from "react-icons/fi"
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { FirebaseError } from "firebase/app"
import { motion, useScroll, useTransform } from "framer-motion"

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
  status?: string
}

export default function Article() {
  // Add scroll tracking
  const { scrollY, scrollYProgress } = useScroll()
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Create all transform values at the top level
  const titleY = useTransform(scrollY, [0, 300], [0, -50])
  const titleScale = useTransform(scrollY, [0, 200], [1, 0.95])
  const imageScale = useTransform(scrollY, [0, 300], [1, 1.1])
  const imageOpacity = useTransform(scrollY, [0, 300], [1, 0.8])
  const imageY = useTransform(scrollY, [0, 300], [0, 20])
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0])
  const bgElement1Y = useTransform(scrollY, [0, 500], [0, -150])
  const bgElement2Y = useTransform(scrollY, [0, 500], [0, 100])
  const overlayOpacity = useTransform(scrollY, [0, 300], [0, 0.6])
  const footerY = useTransform(scrollY, [0, 500], [0, -50])
  const footerOpacity = useTransform(scrollY, [0, 500], [1, 0.8])
  
  
  const params = useParams()
  const router = useRouter()
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasLiked, setHasLiked] = useState(false)
  const [user, setUser] = useState(auth.currentUser)
  const [actionMessage, setActionMessage] = useState<string>('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [articleUrl, setArticleUrl] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSuperior, setIsSuperior] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ action: 'reject' | 'accept' } | null>(null)

  // Definisci useRef al livello più alto del componente
  const hasRunViewCount = useRef(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
      
      // Verifica se l'utente è un amministratore
      const adminEmails = JSON.parse(process.env.NEXT_PUBLIC_ADMIN_EMAILS || "[]")
      const superiorEmails = JSON.parse(process.env.NEXT_PUBLIC_SUPERIOR_EMAILS || "[]")
      
      setIsAdmin(
        currentUser?.email ? adminEmails.includes(currentUser.email) : false
      )
      setIsSuperior(
        currentUser?.email ? superiorEmails.includes(currentUser.email) : false
      )
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const articleId = params.id as string;
        const articleRef = ref(db, `articoli/${articleId}`);
        const snapshot = await get(articleRef);

        if (snapshot.exists()) {
          const articleData = {
            uuid: snapshot.key || '',
            ...snapshot.val()
          };

          // Verifica se l'articolo è in stato di revisione e l'utente non è admin
          if (articleData.status === 'revision' && !isAdmin) {
            router.push('/');
            return;
          }

          setArticle(articleData);
        }
      } catch (error) {
        console.error("Errore nel recupero dell'articolo:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchArticle();
    }
  }, [params.id, isAdmin, router]);

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

  // Inizializza l'URL dell'articolo quando il componente viene montato
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Prepariamo l'URL con il parametro shared
      const baseUrl = window.location.origin + window.location.pathname;
      setArticleUrl(`${baseUrl}?shared=true`);
    }
  }, []);

  // Modifica l'useEffect per il conteggio delle visualizzazioni da condivisione
  useEffect(() => {
    const countSharedView = async () => {
      // Verifica se possiamo incrementare la visualizzazione
      if (
        !hasRunViewCount.current && 
        typeof window !== 'undefined' && 
        window.location.search.includes('shared=true') && 
        article?.uuid && 
        !sessionStorage.getItem(`shared_view_counted_${article.uuid}`)
      ) {
        // Impostiamo subito il flag per evitare esecuzioni multiple
        hasRunViewCount.current = true;
        
        try {
          // Marchiamo immediatamente come conteggiata
          sessionStorage.setItem(`shared_view_counted_${article.uuid}`, 'true');
          
          // Incrementa il contatore sul database (esattamente +1)
          const articleRef = ref(db, `articoli/${article.uuid}`);
          await update(articleRef, {
            view: increment(1)
          });
          
          // Aggiorniamo lo stato locale (esattamente +1)
          setArticle(prev => {
            if (!prev) return null;
            return {
              ...prev,
              view: (prev.view || 0) + 1
            };
          });
          
          // Rimuovi il parametro dall'URL senza ricaricare la pagina
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
          
          console.log('Visualizzazione da condivisione registrata: +1');
        } catch (error) {
          console.error("Errore nell'aggiornamento delle visualizzazioni:", error);
        }
      }
    };
    
    // Esegui solo quando l'articolo è caricato
    if (article) {
      countSharedView();
    }
    
    // Funzione di pulizia che viene eseguita quando il componente si smonta
    return () => {
      hasRunViewCount.current = false;
    };
  }, [article]);

  const handleLike = async () => {
    if (!user) {
      // Reindirizzamento alla pagina di accesso invece di mostrare solo un messaggio
      router.push('/access');
      return;
    }
    
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
    try {
      // Copia il link negli appunti (funziona per tutti)
      await navigator.clipboard.writeText(articleUrl);
      
      // Per gli admin, mostra il modal avanzato
      if (isAdmin) {
        setShowShareModal(true);
      } else {
        // Per utenti normali o non autenticati, mostra solo messaggio di link copiato
        showMessage('Link copiato negli appunti!');
      }
      
      // Aggiorna le statistiche di condivisione solo se l'utente è autenticato
      if (user) {
        try {
          const articleRef = ref(db, `articoli/${params.id}`);
          await update(articleRef, {
            shared: increment(1)
          });
          
          setArticle(prev => prev ? {...prev, shared: (prev.shared || 0) + 1} : null);
        } catch (dbError) {
          console.error("Errore nell'aggiornamento delle statistiche di condivisione:", dbError);
          // Non mostriamo errori all'utente, l'operazione principale (copia link) è già riuscita
        }
      } else {
        // Per gli utenti non autenticati, aggiorniamo solo l'interfaccia utente localmente
        // senza scrivere nel database
        setArticle(prev => prev ? {...prev, shared: (prev.shared || 0) + 1} : null);
      }
    } catch (error) {
      console.error("Errore nella condivisione:", error);
      showMessage("Errore nella condivisione");
    }
  };

  // Funzione per accettare un articolo
  const acceptArticle = async () => {
    if (!article) return;
    
    try {
      const articleRef = ref(db, `articoli/${article.uuid}`)
      await update(articleRef, {
        status: 'accepted'
      })
      
      showMessage("Articolo accettato con successo")
      // Aggiorna lo stato dell'articolo
      setArticle(prev => prev ? { ...prev, status: 'accepted' } : null)
      setConfirmAction(null)
    } catch (error) {
      console.error("Errore durante l'accettazione:", error)
      showMessage("Errore durante l'accettazione dell'articolo")
    }
  }

  // Funzione per rifiutare e eliminare un articolo
  const rejectArticle = async () => {
    if (!article) return;
    
    try {
      // Elimina l'articolo dal database
      const articleRef = ref(db, `articoli/${article.uuid}`);
      await remove(articleRef);
      
      // Elimina l'immagine dallo storage se esiste
      if (article.immagine && article.immagine.includes('firebasestorage.googleapis.com')) {
        try {
          // Estrai il percorso dell'immagine dall'URL
          const storage = getStorage(app);
          const imageUrl = new URL(article.immagine);
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
        }
      }
      
      showMessage("Articolo rifiutato e rimosso con successo");
      setConfirmAction(null);
      
      // Ridireziona alla home dopo un breve ritardo
      setTimeout(() => {
        router.push('/admin/review-articles');
      }, 1500);
    } catch (error) {
      console.error("Errore durante il rifiuto:", error);
      showMessage("Errore durante il rifiuto dell'articolo");
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
        <motion.div 
          className="flex flex-col items-center"
        >
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
            className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full mb-4 flex items-center justify-center"
          >
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-8 h-8 bg-zinc-900 rounded-full"
            />
          </motion.div>
          <motion.span 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-zinc-200 font-medium"
          >
            Caricamento...
          </motion.span>
        </motion.div>
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
              className="inline-flex items-center text-sm text-zinc-200 hover:text-amber-500 transition-colors duration-300 mb-4"
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
                <p className="text-zinc-200 mb-6">
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
        <div className="text-zinc-200">
          Articolo non trovato
        </div>
      </div>
    )
  }

  // Add this function after the renderContentWithNotes function to extract and process YouTube links
  const renderYouTubeVideos = (content: string, additionalLinks: ArticleData['additionalLinks']) => {
    const youtubeVideos = [];
    let contentWithoutYouTube = content;
    
    // Extract YouTube links from content
    const youtubeRegex = /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
    let match;
    while ((match = youtubeRegex.exec(content)) !== null) {
      let videoId = '';
      if (match[0].includes('youtu.be/')) {
        videoId = match[0].split('youtu.be/')[1].split('?')[0];
      } else if (match[0].includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(match[0].split('?')[1]);
        videoId = urlParams.get('v') || '';
      }
      
      if (videoId) {
        youtubeVideos.push({
          id: videoId,
          url: match[0],
          label: `Video ${youtubeVideos.length + 1}`
        });
        
        // Remove the URL from the content
        contentWithoutYouTube = contentWithoutYouTube.replace(match[0], '');
      }
    }
    
    // Extract YouTube links from additionalLinks
    const youtubeAdditionalLinks = additionalLinks?.filter(link => 
      link.url.includes('youtube.com') || link.url.includes('youtu.be')
    ) || [];
    
    youtubeAdditionalLinks.forEach(link => {
      let videoId = '';
      if (link.url.includes('youtu.be/')) {
        videoId = link.url.split('youtu.be/')[1].split('?')[0];
      } else if (link.url.includes('youtube.com/watch')) {
        const urlParams = new URLSearchParams(link.url.split('?')[1]);
        videoId = urlParams.get('v') || '';
      } else if (link.url.includes('youtube.com/embed/')) {
        videoId = link.url.split('youtube.com/embed/')[1].split('?')[0];
      }
      
      if (videoId) {
        youtubeVideos.push({
          id: videoId,
          url: link.url,
          label: link.label
        });
      }
    });
    
    return {
      videos: youtubeVideos,
      contentWithoutYouTube,
      nonYouTubeLinks: additionalLinks?.filter(link => 
        !link.url.includes('youtube.com') && !link.url.includes('youtu.be')
      ) || []
    };
  };

  // Update the renderContentWithNotes function for the animated fade out
  const renderContentWithNotes = (content: string, notes?: ArticleData['notes']) => {
    if (!content) return '';
    
    // First handle existing note annotations
    let processedContent = content;
    if (notes && notes.length > 0) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');

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
      
      processedContent = doc.body.innerHTML;
    }
    
    // Get the number of secondary notes to check against
    const secondaryNotesCount = article?.secondaryNotes?.length || 0;
    
    // Then handle [number] patterns and make them clickable links only if they correspond to existing notes
    const notePattern = /\[(\d+)\]/g;
    processedContent = processedContent.replace(notePattern, (match, noteNumber) => {
      // Only make it clickable if the note number is valid (exists and is within range)
      const noteIndex = parseInt(noteNumber, 10);
      if (noteIndex > 0 && noteIndex <= secondaryNotesCount) {
        return `<a href="#note-${noteNumber}" class="note-reference" 
          onclick="event.preventDefault(); 
          const noteElement = document.getElementById('note-${noteNumber}');
          noteElement.scrollIntoView({behavior: 'smooth'}); 
          const textElement = noteElement.querySelector('p');
          if (textElement) {
            textElement.classList.add('highlight-note-text');
            
            // Aggiungiamo un'animazione per il fade out usando una seconda classe
            setTimeout(() => {
              textElement.classList.remove('highlight-note-text');
              textElement.classList.add('highlight-note-text-fade');
              
              // Rimuoviamo la classe di fade dopo che l'animazione è completata
              textElement.addEventListener('animationend', function handler() {
                textElement.classList.remove('highlight-note-text-fade');
                textElement.removeEventListener('animationend', handler);
              });
            }, 1500);
          }">${match}</a>`;
      } else {
        // Return the original text without making it clickable
        return match;
      }
    });
    
    return processedContent;
  };

  // Update CSS for the highlight effect with animation
  const highlightNoteStyle = `
    .highlight-note-text {
      background-color: rgba(245, 158, 11, 0.3);
      border-radius: 0.25rem;
      padding: 0.15rem 0.25rem;
      animation: highlightFadeIn 0.3s ease-in-out;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    
    .highlight-note-text-fade {
      background-color: rgba(245, 158, 11, 0);
      border-radius: 0.25rem;
      padding: 0.15rem 0.25rem;
      animation: highlightFadeOut 1s ease-in-out;
      box-shadow: 0 0px 0px rgba(0, 0, 0, 0);
    }
    
    @keyframes highlightFadeIn {
      from {
        background-color: rgba(245, 158, 11, 0);
        box-shadow: 0 0px 0px rgba(0, 0, 0, 0);
      }
      to {
        background-color: rgba(245, 158, 11, 0.3);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }
    }
    
    @keyframes highlightFadeOut {
      from {
        background-color: rgba(245, 158, 11, 0.3);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }
      to {
        background-color: rgba(245, 158, 11, 0);
        box-shadow: 0 0px 0px rgba(0, 0, 0, 0);
      }
    }
  `;

  // Inject the CSS into the document
  if (typeof document !== 'undefined') {
    const styleElement = document.createElement('style');
    styleElement.textContent = highlightNoteStyle;
    document.head.appendChild(styleElement);
  }

  // Inside the return statement, where article content is rendered
  // First, get YouTube videos and processed content
  const { videos, contentWithoutYouTube, nonYouTubeLinks } = renderYouTubeVideos(
    article?.contenuto || '', 
    article?.additionalLinks
  );

  // Aggiungi un componente semplificato per il modale di condivisione
  const ShareModal = () => {
    const [copied, setCopied] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const copyLink = () => {
      navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showMessage('Link copiato negli appunti!');
    };
    
    const downloadInstagramImage = async () => {
      try {
        setIsGenerating(true);
        showMessage('Preparazione immagine...');
        
        // Creiamo un canvas direttamente
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          showMessage("Errore nella generazione dell'immagine");
          setIsGenerating(false);
          return;
        }
        
        // Dimensioni per Instagram (formato quadrato)
        canvas.width = 1080;
        canvas.height = 1080;
        
        // Carica l'immagine dell'articolo
        const loadImage = (src: string) => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = document.createElement('img');
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
          });
        };
        
        // Ottieni un QR code come immagine da un API gratuito
        const getQRCodeImage = async (url: string) => {
          // Assicuriamoci che l'URL contenga il parametro shared
          let qrUrl = url;
          if (!qrUrl.includes('shared=true')) {
            qrUrl = qrUrl.includes('?') 
              ? `${qrUrl}&shared=true` 
              : `${qrUrl}?shared=true`;
          }
          
          // Encodiamo l'URL per l'API
          const encodedUrl = encodeURIComponent(qrUrl);
          
          // Utilizziamo QR Server che permette di personalizzare il colore
          const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodedUrl}&size=250x250&color=F59E0B&bgcolor=FFFFFF`;
          
          try {
            return await loadImage(qrImageUrl);
          } catch (error) {
            console.error('Errore nel caricamento del QR code:', error);
            return null;
          }
        };
        
        // Sfondo nero iniziale
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Carica l'immagine dell'articolo per lo sfondo
        let bgImage = null;
        try {
          bgImage = await loadImage(article?.immagine || '');
          
          // Disegna l'immagine di sfondo
          ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
          
          // Overlay scuro per leggibilità
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } catch {
          console.log('Impossibile caricare l\'immagine di sfondo, uso sfondo scuro standard');
          // Mantieni il background nero se l'immagine non può essere caricata
        }
        
        // Logo "STEELE NEWS" in alto
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('STEELE NEWS', canvas.width / 2, 100);
        
        // Data sotto il logo
        const formattedDate = new Date(article?.creazione || Date.now()).toLocaleDateString('it-IT', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        ctx.font = 'italic 28px Arial';
        ctx.fillText(formattedDate, canvas.width / 2, 150);
        
        // Tag dell'articolo (se presente)
        if (article?.tag) {
          // Sfondo per il tag
          ctx.fillStyle = '#F59E0B'; // Arancione
          const tagWidth = ctx.measureText(article.tag).width + 40;
          const tagX = canvas.width / 2 - tagWidth / 2;
          ctx.fillRect(tagX, 200, tagWidth, 50);
          
          // Testo del tag
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 30px Arial';
          ctx.fillText(article.tag, canvas.width / 2, 235);
        }
        
        // Funzione per testo multilinea
        const drawWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
          const words = text.split(' ');
          let line = '';
          let lineCount = 0;
          
          for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
              ctx.fillText(line, x, y + (lineCount * lineHeight));
              line = words[n] + ' ';
              lineCount++;
            } else {
              line = testLine;
            }
          }
          
          ctx.fillText(line, x, y + (lineCount * lineHeight));
          return lineCount + 1;
        };
        
        // Titolo dell'articolo (centrato)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        const titleY = article?.tag ? 300 : 250;
        const titleLineCount = drawWrappedText(
          article?.titolo || 'Articolo',
          canvas.width / 2,
          titleY,
          canvas.width - 100,
          60
        );
        
        // Autore
        ctx.font = 'italic 36px Arial';
        ctx.fillText(`di ${article?.autore || 'Autore'}`, canvas.width / 2, titleY + (titleLineCount * 60) + 20);
        
        // Area per il QR code
        const qrSize = 250;
        const qrX = canvas.width / 2 - qrSize / 2;
        const qrY = canvas.height - qrSize - 150;
        
        // Sfondo bianco per il QR code
        ctx.fillStyle = 'white';
        ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
        
        // Carica e disegna il QR code
        const qrImage = await getQRCodeImage(articleUrl);
        if (qrImage) {
          // Disegna il QR code
          ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
        } else {
          // Fallback in caso di errore - disegna un segnaposto
          ctx.fillStyle = '#F59E0B';
          ctx.textAlign = 'center';
          ctx.font = 'bold 24px Arial';
          ctx.fillText('Scannerizza il QR code sul sito', canvas.width / 2, qrY + qrSize / 2);
          
          // Disegna un bordo arancione attorno al segnaposto
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 8;
          ctx.strokeRect(qrX, qrY, qrSize, qrSize);
        }
        
        // Testo sotto il QR code
        ctx.fillStyle = '#ffffff';
        ctx.font = '32px Arial';
        ctx.fillText('Scannerizza per leggere l\'articolo completo', canvas.width / 2, canvas.height - 80);
        
        // Converti in immagine e scarica
        const link = document.createElement('a');
        link.download = `steele-news-${article?.titolo?.replace(/\s+/g, '-').toLowerCase() || 'article'}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showMessage('Immagine scaricata con successo!');
        setIsGenerating(false);
      } catch (error) {
        console.error("Errore nella generazione dell'immagine:", error);
        showMessage("Errore nella generazione dell'immagine");
        setIsGenerating(false);
      }
    };
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-zinc-800 rounded-2xl p-6 max-w-md w-full mx-auto shadow-2xl border border-zinc-700/50">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">Condividi articolo</h3>
            <button 
              onClick={() => setShowShareModal(false)}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Nota informativa */}
          <p className="text-zinc-400 text-sm mb-6">
            Puoi copiare il link dell&apos;articolo o scaricare un&apos;immagine ottimizzata per Instagram con QR code.
          </p>
          
          {/* Pulsanti principali - rimuovi i pulsanti social e mantieni solo questi due */}
          <div className="space-y-4">
            {/* Pulsante Copia Link */}
            <button
              onClick={copyLink}
              className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors duration-300 ${
                copied ? 'bg-green-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
              }`}
            >
              {copied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Link copiato
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copia link articolo
                </>
              )}
            </button>
            
            {/* Pulsante Instagram */}
            <button
              onClick={downloadInstagramImage}
              disabled={isGenerating}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-opacity duration-300 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generazione in corso...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Scarica per Instagram
                </>
              )}
            </button>
          </div>
          
          {/* Nota informativa sul QR code */}
          <div className="mt-6 p-3 bg-zinc-700/30 rounded-lg">
            <p className="text-zinc-300 text-xs text-center">
              L&apos;immagine scaricata includerà un QR code arancione che rimanda a questo articolo.
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.main 
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800 overflow-hidden"
    >
      {/* Fixed scroll progress bar */}
      <motion.div
        initial={{ scaleX: 0 }}
        className="fixed top-0 left-0 right-0 h-1 bg-amber-500 z-50 origin-left"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Parallax background elements */}
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
          className="absolute -top-[10%] -right-[20%] h-[60vh] w-[60vh] rounded-full bg-gradient-to-br from-amber-500 to-orange-500 blur-3xl"
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
          className="absolute -bottom-[30%] -left-[10%] h-[80vh] w-[80vh] rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 blur-3xl"
        />
      </motion.div>

      {/* Toast message */}
      {actionMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-zinc-700 text-white rounded-lg shadow-lg"
        >
          {actionMessage}
        </motion.div>
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
                  ? rejectArticle() 
                  : acceptArticle()
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

      <div className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* Header with navigation */}
        <motion.div 
          style={{ opacity: headerOpacity }}
          className="mb-8"
        >
          <motion.div
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Link 
              href={isAdmin && article?.status === 'revision' ? "/admin/review-articles" : "/articles"}
              className="inline-flex items-center text-sm text-zinc-400 hover:text-amber-400 transition-colors duration-300 mb-4"
            >
              <FiArrowLeft className="mr-2 h-4 w-4" />
              {isAdmin && article?.status === 'revision' ? "Torna a revisione articoli" : "Torna agli articoli"}
            </Link>
          </motion.div>
          
          {/* Banner di revisione */}
          {article?.status === 'revision' && (isSuperior || isAdmin) && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-purple-500/20 border border-purple-500/30 rounded-xl p-4 mb-4 flex items-center justify-between"
            >
              <div className="flex items-center">
                <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center mr-3">
                  <FiEye className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-purple-100">Articolo in revisione</h3>
                  <p className="text-sm text-purple-200/70">Questo articolo non è ancora pubblicato e richiede approvazione.</p>
                </div>
              </div>
              
              {isSuperior && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmAction({ action: 'reject' })}
                    className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors duration-200 cursor-pointer"
                    title="Rifiuta articolo"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setConfirmAction({ action: 'accept' })}
                    className="p-2 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors duration-200 cursor-pointer"
                    title="Approva articolo"
                  >
                    <FiCheck className="h-5 w-5" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Main image with parallax effect */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          whileHover={{ boxShadow: "0 20px 60px -15px rgba(0,0,0,0.5)" }}
          className="relative w-full aspect-video max-w-4xl mx-auto mb-8 rounded-2xl overflow-hidden"
        >
          <motion.div
            style={{ 
              scale: imageScale,
              opacity: imageOpacity,
              y: imageY
            }}
            className="absolute inset-0"
          >
            <Image
              src={article?.immagine || ''}
              alt={article?.titolo || ''}
              fill
              className="object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = '/placeholder-image.jpg'
              }}
            />
            <motion.div 
              className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 to-transparent"
              style={{ 
                opacity: overlayOpacity
              }}
            />
          </motion.div>
        </motion.div>

        {/* Article content */}
        <motion.article 
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <motion.h1 
            style={{ 
              y: titleY,
              scale: titleScale
            }}
            className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-50 mb-6 text-center"
          >
            {article?.titolo}
          </motion.h1>

          {/* Info and metrics */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-wrap items-center justify-between gap-4 mb-8 text-sm"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-50">Autore:</span>
                <span className="text-zinc-400">{article?.autore}</span>
              </div>
              {article?.partecipanti && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-50">Partecipanti:</span>
                  <span className="text-zinc-400">
                    {Array.isArray(article.partecipanti) 
                      ? article.partecipanti.join(', ')
                      : article.partecipanti}
                  </span>
                </div>
              )}
              <span className="flex items-center text-zinc-400">
                <FiClock className="mr-1 h-4 w-4" />
                {getTimeAgo(article?.creazione || '')}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: hasLiked ? '#e11d48' : 'rgba(225, 29, 72, 0.9)' }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLike}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all duration-300 cursor-pointer
                  ${hasLiked 
                    ? 'bg-rose-500 text-white' 
                    : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'
                  }`}
              >
                <motion.div
                  animate={hasLiked ? { 
                    scale: [1, 1.2, 1],
                  } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <FiHeart className={`h-4 w-4 ${hasLiked ? 'fill-current' : ''}`} />
                </motion.div>
                {article?.upvote || 0}
              </motion.button>
              <motion.span 
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-full"
              >
                <FiEye className="h-4 w-4" />
                {article?.view || 0}
              </motion.span>
              <motion.button 
                whileHover={{ scale: 1.1, backgroundColor: '#10b981', color: 'white' }}
                whileTap={{ scale: 0.95 }}
                onClick={handleShare}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full hover:bg-emerald-500 hover:text-white transition-all duration-300 cursor-pointer"
              >
                <FiShare2 className="h-4 w-4" />
                {article?.shared || 0}
              </motion.button>
            </div>
          </motion.div>

          {/* Content with staggered paragraph reveals */}
          <motion.span 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="text-lg leading-9 tracking-[0.04em] text-white !text-white
              font-montserrat block space-y-6 [&>p]:mb-6 
              [&>p]:leading-relaxed [&>p]:tracking-wide
              [&>*]:tracking-wide [&>*]:leading-relaxed
              [&>*]:!text-white
              [&_p]:!text-white
              [&_span]:!text-white
              [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white
              [&_h4]:!text-white [&_h5]:!text-white [&_h6]:!text-white
              [&_li]:!text-white [&_div]:!text-white
              [&_a]:!text-white
              [&_*]:!text-white
              [&_.note-text]:relative
              [&_.note-text]:border-b
              [&_.note-text]:border-dashed
              [&_.note-text]:border-amber-500/50
              [&_.note-text]:cursor-help
              [&_.note-text]:inline-flex
              [&_.note-text]:items-center
              [&_.note-text]:gap-0.5
              [&_.note-text]:group
              [&_mark]:bg-amber-500/30
              [&_mark]:!text-black
              [&_mark]:font-medium
              [&_mark]:px-1
              [&_mark]:py-0.5
              [&_mark]:rounded-sm
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
              [&_.note-text:hover_.note-tooltip]:translate-y-0
              [&_.note-reference]:text-amber-400
              [&_.note-reference]:border-b
              [&_.note-reference]:border-dashed
              [&_.note-reference]:border-amber-500/50
              [&_.note-reference]:cursor-pointer
              [&_.note-reference]:hover:text-amber-300"
            dangerouslySetInnerHTML={{ 
              __html: renderContentWithNotes(contentWithoutYouTube || '', article?.notes) 
            }}
          />

          {/* YouTube Videos Section */}
          {videos.length > 0 && (
            <div className="mt-10 mb-8">
              <h3 className="text-sm font-medium text-zinc-400 mb-6 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
                Video
              </h3>
              <div className="space-y-8">
                {videos.map((video, idx) => (
                  <div key={idx} className="w-full flex flex-col items-center">
                    <div className="w-full max-w-full aspect-video">
                      <iframe
                        className="w-full h-full rounded-xl border border-zinc-700/50"
                        src={`https://www.youtube.com/embed/${video.id}`}
                        title="YouTube video"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note secondarie */}
          {article.secondaryNotes && article.secondaryNotes.length > 0 && (
            <div className="border-t border-zinc-700 pt-6 mt-8">
              <h3 className="text-sm font-medium text-zinc-400 mb-4" id="notes-section">
                Note
              </h3>
              <div className="space-y-3">
                {article.secondaryNotes.map((note, index) => (
                  <div 
                    id={`note-${index + 1}`} 
                    key={note.id} 
                    className="flex items-start gap-2 text-xs font-montserrat transition-colors duration-300"
                  >
                    <span className="font-medium text-amber-400 flex-shrink-0">
                      [{index + 1}]
                    </span>
                    <p className="text-zinc-400 tracking-wide leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link aggiuntivi - solo link non YouTube */}
          {nonYouTubeLinks.length > 0 && (
            <div className="border-t border-zinc-700 pt-6 mt-8">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">
                Link correlati
              </h3>
              <div className="flex flex-col gap-5">
                {nonYouTubeLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors duration-200"
                  >
                    <span className="font-montserrat text-lg">{link.label}</span>
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

          {/* Footer with parallax effect */}
          <motion.div 
            style={{ 
              y: footerY,
              opacity: footerOpacity
            }}
            className="border-t border-zinc-700 pt-8 mt-20"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <span className="font-medium text-zinc-50 block mb-1">Autore</span>
                  <span className="text-zinc-400">{article?.autore}</span>
                </div>
                
                {article?.partecipanti && (
                  <div>
                    <span className="font-medium text-zinc-50 block mb-1">Partecipanti</span>
                    <span className="text-zinc-400">
                      {Array.isArray(article.partecipanti) 
                        ? article.partecipanti.join(', ')
                        : article.partecipanti}
                    </span>
                  </div>
                )}
                
                <span className="flex items-center text-zinc-400">
                  <FiClock className="mr-1 h-4 w-4" />
                  {getTimeAgo(article?.creazione || '')}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: hasLiked ? '#e11d48' : 'rgba(225, 29, 72, 0.9)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLike}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition-all duration-300 cursor-pointer
                    ${hasLiked 
                      ? 'bg-rose-500 text-white' 
                      : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'
                    }`}
                >
                  <motion.div
                    animate={hasLiked ? { 
                      scale: [1, 1.2, 1],
                    } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <FiHeart className={`h-4 w-4 ${hasLiked ? 'fill-current' : ''}`} />
                  </motion.div>
                  {article?.upvote || 0}
                </motion.button>
                <motion.span 
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-full"
                >
                  <FiEye className="h-4 w-4" />
                  {article?.view || 0}
                </motion.span>
                <motion.button 
                  whileHover={{ scale: 1.1, backgroundColor: '#10b981', color: 'white' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleShare}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full hover:bg-emerald-500 hover:text-white transition-all duration-300 cursor-pointer"
                >
                  <FiShare2 className="h-4 w-4" />
                  {article?.shared || 0}
                </motion.button>
              </div>
            </div>
            
            {/* Back to top button with animation */}
            <div className="flex justify-center mt-10">
              <motion.button
                whileHover={{ scale: 1.1, y: -3, backgroundColor: '#3f3f46' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-full transition-colors duration-300"
              >
                <motion.div
                  animate={{ y: [2, -2, 2] }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: "mirror" }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </motion.div>
                <span>Torna in cima</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.article>
      </div>

      {/* Modal per la condivisione (solo per admin) */}
      {showShareModal && <ShareModal />}
    </motion.main>
  )
} 
