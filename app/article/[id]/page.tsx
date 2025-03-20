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
  const [showShareModal, setShowShareModal] = useState(false)
  const [articleUrl, setArticleUrl] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser)
      
      // Verifica se l'utente è un amministratore
      const adminEmails = [
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_1,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_2,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_3,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL_4
      ]
      
      setIsAdmin(
        currentUser?.email ? adminEmails.includes(currentUser.email) : false
      )
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

  // Inizializza l'URL dell'articolo quando il componente viene montato
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setArticleUrl(window.location.href)
    }
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
    try {
      // Copia il link negli appunti (funziona per tutti)
      await navigator.clipboard.writeText(articleUrl)
      
      // Per gli admin, mostra il modal avanzato
      if (isAdmin) {
        setShowShareModal(true)
      } else {
        // Per utenti normali o non autenticati, mostra solo messaggio di link copiato
        showMessage('Link copiato negli appunti!')
      }
      
      // Aggiorna le statistiche di condivisione solo se l'utente è autenticato
      if (user) {
        try {
          const articleRef = ref(db, `articoli/${params.id}`)
          await update(articleRef, {
            shared: increment(1)
          })
          
          setArticle(prev => prev ? {...prev, shared: (prev.shared || 0) + 1} : null)
        } catch (dbError) {
          console.error("Errore nell'aggiornamento delle statistiche di condivisione:", dbError)
          // Non mostriamo errori all'utente, l'operazione principale (copia link) è già riuscita
        }
      } else {
        // Per gli utenti non autenticati, aggiorniamo solo l'interfaccia utente localmente
        // senza scrivere nel database
        setArticle(prev => prev ? {...prev, shared: (prev.shared || 0) + 1} : null)
      }
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
        <div className="animate-pulse text-zinc-200">
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
          // Encodiamo l'URL per l'API
          const encodedUrl = encodeURIComponent(url);
          
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
        
        // Logo "PAXMAN NEWS" in alto
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PAXMAN NEWS', canvas.width / 2, 100);
        
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
        link.download = `paxman-news-${article?.titolo?.replace(/\s+/g, '-').toLowerCase() || 'article'}.png`;
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
    <main className="min-h-screen bg-gradient-to-br from-zinc-900 to-zinc-800">
      {/* Toast message */}
      {actionMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-zinc-700 text-white rounded-lg shadow-lg transition-opacity duration-300">
          {actionMessage}
        </div>
      )}

      <div className="container mx-auto px-4 py-8 sm:py-12">
        {/* Header con navigazione */}
        <div className="mb-8">
          <Link 
            href="/articles"
            className="inline-flex items-center text-sm text-zinc-400 hover:text-amber-400 transition-colors duration-300 mb-4"
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
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-50 mb-6 text-center">
            {article.titolo}
          </h1>

          {/* Info e metriche */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 text-sm">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-50">Autore:</span>
                <span className="text-zinc-400">{article.autore}</span>
              </div>
              {article.partecipanti && (
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
            className="text-lg leading-9 tracking-[0.04em] text-zinc-300
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
              [&_.note-text:hover_.note-tooltip]:translate-y-0"
            dangerouslySetInnerHTML={{ 
              __html: renderContentWithNotes(article.contenuto, article.notes) 
            }}
          />

          {/* Note secondarie */}
          {article.secondaryNotes && article.secondaryNotes.length > 0 && (
            <div className="border-t border-zinc-700 pt-6 mt-8">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">
                Note
              </h3>
              <div className="space-y-3">
                {article.secondaryNotes.map((note, index) => (
                  <div key={note.id} className="flex items-start gap-2 text-xs font-montserrat">
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

          {/* Link aggiuntivi con design minimal */}
          {article.additionalLinks && article.additionalLinks.length > 0 && (
            <div className="border-t border-zinc-700 pt-6 mt-8">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">
                Link correlati
              </h3>
              <div className="flex flex-wrap gap-3">
                {article.additionalLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className=" inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors duration-200"
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

          {/* Footer con info e metriche ripetute */}
          <div className="border-t border-zinc-700 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <span className="font-medium text-zinc-50 block mb-1">Autore</span>
                  <span className="text-zinc-400">{article.autore}</span>
                </div>
                
                {article.partecipanti && (
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
            
            {/* Pulsante per tornare in cima */}
            <div className="flex justify-center mt-10">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="cursor-pointerflex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-full transition-colors duration-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span>Torna in cima</span>
              </button>
            </div>
          </div>
        </article>
      </div>

      {/* Modal per la condivisione (solo per admin) */}
      {showShareModal && <ShareModal />}
    </main>
  )
} 
