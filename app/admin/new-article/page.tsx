"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { v4 as uuidv4 } from "uuid"
import { FiArrowLeft, FiSave, FiTag, FiUser, FiUsers, FiCalendar, FiCheck, FiX, FiUpload } from "react-icons/fi"
import { Button } from "@heroui/react"
import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { getDatabase, ref as dbRef, set } from "firebase/database"
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"

// Configura Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: "https://giornalino-c2682-default-rtdb.europe-west1.firebasedatabase.app/"
}

// Inizializza Firebase solo se non è già stato inizializzato
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getDatabase(app)
const storage = getStorage(app)

// Categorie disponibili
const availableCategories = [
  "ATTUALITÀ",
  "POLITICA",
  "ESTERO",
  "ECONOMIA",
  "TECNOLOGIA",
  "SPORT",
  "AVIAZIONE",
  "SCIENZE",
  "MODA",
  "ITALIA"
]

export default function NewArticlePage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Campi dell'articolo
  const [titolo, setTitolo] = useState("")
  const [autore, setAutore] = useState("")
  const [contenuto, setContenuto] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagsDropdown, setShowTagsDropdown] = useState(false)
  const [partecipanti, setPartecipanti] = useState("")
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  
  // Verifica se l'utente è autorizzato
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === "realeaquila.929@gmail.com") {
        setIsAdmin(true)
        setAutore(user.displayName || user.email || "")
      } else {
        // Reindirizza alla home se non è l'admin
        router.push("/")
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  // Chiudi il dropdown dei tag quando si clicca fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagsDropdown(false)
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Funzione per mostrare notifiche
  const showNotification = (type: string, message: string) => {
    setNotification({ type, message })
    
    // Rimuovi la notifica dopo 5 secondi
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  // Gestione del file selezionato
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
    
    if (file) {
      // Crea un URL per l'anteprima
      const previewURL = URL.createObjectURL(file)
      setImagePreview(previewURL)
      
      // Pulisci l'URL quando il componente viene smontato
      return () => URL.revokeObjectURL(previewURL)
    } else {
      setImagePreview(null)
    }
  }

  // Funzione per caricare l'immagine su Firebase Storage
  const uploadImage = async (file: File, uuid: string): Promise<string> => {
    // Ottieni l'estensione del file
    const fileExtension = file.name.split('.').pop()
    
    // Crea un riferimento con l'UUID come nome file
    const fileRef = storageRef(storage, `articoli/${uuid}.${fileExtension}`)
    
    return new Promise((resolve, reject) => {
      // Crea un task di caricamento con monitoraggio del progresso
      const uploadTask = uploadBytesResumable(fileRef, file)
      
      // Gestisci gli eventi del caricamento
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Aggiorna il progresso
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          setUploadProgress(progress)
        },
        (error) => {
          // Gestisci gli errori
          console.error("Errore durante il caricamento:", error)
          
          // Gestisci specificamente gli errori di permesso
          if (error.code === 'storage/unauthorized') {
            reject(new Error("Non hai i permessi per caricare file. Verifica di essere autenticato e che le regole di sicurezza lo permettano."))
          } else {
            reject(new Error(`Errore durante il caricamento: ${error.message}`))
          }
        },
        async () => {
          // Caricamento completato con successo
          try {
            // Ottieni l'URL di download
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            resolve(downloadURL)
          } catch (error) {
            reject(new Error(`Errore nel recupero dell'URL: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`))
          }
        }
      )
    })
  }

  // Funzione per salvare l'articolo
  const saveArticle = async () => {
    // Validazione
    if (!titolo || !autore || !contenuto || !selectedFile || selectedTags.length === 0) {
      showNotification("error", "Compila tutti i campi obbligatori, seleziona almeno un tag e carica un'immagine")
      return
    }

    // Verifica che l'utente sia autenticato
    const currentUser = auth.currentUser
    if (!currentUser) {
      showNotification("error", "Devi essere autenticato per pubblicare un articolo")
      return
    }

    setSaving(true)
    setUploadProgress(0)

    try {
      // Genera un UUID per l'articolo
      const articleUuid = uuidv4()
      
      // Carica l'immagine e ottieni l'URL
      let imageUrl = ""
      try {
        imageUrl = await uploadImage(selectedFile, articleUuid)
      } catch (error) {
        showNotification("error", error instanceof Error ? error.message : "Errore durante il caricamento dell'immagine")
        setUploadProgress(0)
        setSaving(false)
        return
      }
      
      // Crea l'oggetto articolo
      const articleData = {
        titolo,
        autore,
        contenuto,
        immagine: imageUrl,
        tag: selectedTags.join(", "),
        partecipanti,
        uuid: articleUuid,
        creazione: new Date().toISOString(),
        upvote: 0,
        shared: 0,
        view: 0,
        userId: currentUser.uid // Aggiungi l'ID dell'utente per le regole di sicurezza
      }

      try {
        // Salva nel Realtime Database
        const articleRef = dbRef(db, `articoli/${articleUuid}`)
        await set(articleRef, articleData)
        
        showNotification("success", "Articolo creato con successo!")
        
        // Resetta i campi dopo il salvataggio
        setTimeout(() => {
          setTitolo("")
          setContenuto("")
          setSelectedFile(null)
          setImagePreview(null)
          setSelectedTags([])
          setPartecipanti("")
          setUploadProgress(0)
          setSaving(false)
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        }, 1500)
      } catch (dbError) {
        console.error("Errore durante il salvataggio nel database:", dbError)
        showNotification("error", "Errore durante il salvataggio nel database. Verifica le regole di sicurezza.")
        setUploadProgress(0)
        setSaving(false)
      }
      
    } catch (error) {
      console.error("Errore durante il salvataggio:", error)
      showNotification("error", error instanceof Error ? error.message : "Si è verificato un errore durante il salvataggio")
      setUploadProgress(0)
      setSaving(false)
    }
  }

  // Gestione dei tag
  const toggleTag = (tag: string) => {
    // Converti il tag in maiuscolo
    const upperCaseTag = tag.toUpperCase();
    
    if (selectedTags.includes(upperCaseTag)) {
      // Impedisci la rimozione se è l'ultimo tag rimasto
      if (selectedTags.length <= 1) {
        showNotification("error", "È necessario selezionare almeno un tag");
        return;
      }
      setSelectedTags(selectedTags.filter(t => t !== upperCaseTag));
    } else {
      setSelectedTags([...selectedTags, upperCaseTag]);
    }
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
      <div className="max-w-5xl mx-auto mb-8">
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
      
      {/* Contenuto principale */}
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Crea un nuovo articolo
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-300 text-sm sm:text-base">
            Compila tutti i campi per creare un nuovo articolo
          </p>
        </div>
        
        {/* Form */}
        <div className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl shadow-2xl p-8 transition-all duration-500 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_20px_60px_-15px_rgba(255,255,255,0.1)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Titolo */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Titolo *</label>
              <input
                type="text"
                value={titolo}
                onChange={(e) => setTitolo(e.target.value)}
                className="w-full p-4 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                placeholder="Inserisci il titolo dell'articolo"
                required
              />
            </div>
            
            {/* Autore */}
            <div className="relative">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Autore *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                  <FiUser className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={autore}
                  onChange={(e) => setAutore(e.target.value)}
                  className="w-full pl-10 p-4 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                  placeholder="Nome dell'autore"
                  required
                />
              </div>
            </div>
            
            {/* Caricamento immagine */}
            <div className="relative">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Immagine *</label>
              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  required
                />
                <div className="flex items-center gap-3">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-grow p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none cursor-pointer flex items-center"
                  >
                    <div className="mr-3 flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <FiUpload className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div className="flex-1 truncate">
                      {selectedFile ? (
                        <span className="font-medium">{selectedFile.name}</span>
                      ) : (
                        <span className="text-zinc-500">Clicca per caricare un&apos;immagine</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Piccola anteprima */}
                  {imagePreview && (
                    <div className="relative h-14 w-14 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-sm">
                      <img 
                        src={imagePreview} 
                        alt="Anteprima" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                
                {/* Barra di progresso durante il caricamento */}
                {saving && uploadProgress > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Caricamento in corso...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500">Formati supportati: JPG, PNG, GIF. Max 5MB.</p>
            </div>
            
            {/* Tag - Selezione multipla */}
            <div className="relative" ref={tagDropdownRef}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Tag</label>
              <div className="relative">
                <div 
                  className="flex items-center flex-wrap w-full p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none cursor-pointer min-h-[56px]"
                  onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                >
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-zinc-500">
                    <FiTag className="h-5 w-5" />
                  </div>
                  <div className="pl-7 flex flex-wrap gap-2">
                    {selectedTags.length > 0 ? (
                      selectedTags.map(tag => (
                        <span 
                          key={tag} 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        >
                          {tag}
                          <button 
                            type="button" 
                            className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTag(tag);
                            }}
                          >
                            <FiX className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-zinc-500">Seleziona una o più categorie</span>
                    )}
                  </div>
                </div>
                
                {/* Dropdown per la selezione dei tag */}
                {showTagsDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 max-h-60 overflow-auto animate-fade-in">
                    {availableCategories.map(category => (
                      <div 
                        key={category}
                        className={`flex items-center px-3 py-2 cursor-pointer hover:bg-blue-500/10 ${
                          selectedTags.includes(category) ? 'bg-blue-500/10' : ''
                        }`}
                        onClick={() => toggleTag(category)}
                      >
                        <div className={`flex-shrink-0 h-4 w-4 mr-2 rounded border ${
                          selectedTags.includes(category) 
                            ? 'bg-blue-500 border-blue-500 flex items-center justify-center' 
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {selectedTags.includes(category) && (
                            <FiCheck className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-zinc-800 dark:text-zinc-200">{category}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Partecipanti */}
            <div className="relative">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Partecipanti</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                  <FiUsers className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={partecipanti}
                  onChange={(e) => setPartecipanti(e.target.value)}
                  className="w-full pl-10 p-4 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                  placeholder="Altri partecipanti all'articolo"
                />
              </div>
            </div>
            
            {/* Data di creazione (solo visualizzazione) */}
            <div className="relative">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Data di creazione</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                  <FiCalendar className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={new Date().toLocaleString('it-IT')}
                  className="w-full pl-10 p-4 bg-white/5 border border-white/20 rounded-xl text-zinc-900 dark:text-zinc-50 outline-none cursor-not-allowed opacity-70"
                  disabled
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">La data di creazione verrà impostata automaticamente</p>
            </div>
            
            {/* Contenuto */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Contenuto *</label>
              <textarea
                value={contenuto}
                onChange={(e) => setContenuto(e.target.value)}
                rows={12}
                className="w-full p-4 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                placeholder="Scrivi il contenuto dell'articolo..."
                required
              ></textarea>
            </div>
          </div>
          
          {/* Pulsante di salvataggio */}
          <div className="mt-8 flex justify-end">
            <Button
              variant="solid"
              className={`py-4 px-8 bg-gradient-to-r rounded-xl from-amber-500 to-orange-600 text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-90 hover:shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02] text-base font-medium tracking-wide ${
                saving ? "opacity-70 pointer-events-none" : ""
              }`}
              onClick={saveArticle}
              disabled={saving}
            >
              <FiSave className="mr-2 h-5 w-5" />
              {saving ? "Salvataggio in corso..." : "Salva articolo"}
            </Button>
          </div>
        </div>
        
        {/* Informazioni aggiuntive */}
        <div className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
          <p>I campi contrassegnati con * sono obbligatori</p>
          <p className="mt-1">L&apos;articolo sarà pubblicato immediatamente dopo il salvataggio</p>
        </div>
      </div>
    </main>
  )
} 