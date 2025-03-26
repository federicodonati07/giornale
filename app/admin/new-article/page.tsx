"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { v4 as uuidv4 } from "uuid"
import { FiArrowLeft, FiSave, FiTag, FiUser, FiUsers, FiCalendar, FiCheck, FiX, FiUpload, FiChevronDown, FiPlus, FiTrash2 } from "react-icons/fi"
import { Button } from "@heroui/react"
import { onAuthStateChanged } from "firebase/auth"
import { ref as dbRef, set, get, push } from "firebase/database"
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { auth, db, storage } from "../../firebase"
import { motion, useScroll, useTransform } from "framer-motion"

// Categorie disponibili
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
]

// Aggiungi questo all'interfaccia ArticleData se esiste, altrimenti creala
interface ArticleData {
  titolo: string;
  autore: string;
  contenuto: string;
  immagine: string;
  tag: string;
  partecipanti?: string;
  additionalLinks?: Array<{ url: string, label: string }>;
  secondaryNotes?: Array<{ id: string, content: string }>;
  uuid: string;
  creazione: string;
  upvote: number;
  shared: number;
  view: number;
  userId: string;
  isPrivate: boolean;
  status: string;
}

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
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showTagsDropdown, setShowTagsDropdown] = useState(false)
  const [partecipanti, setPartecipanti] = useState("")
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  
  // Refs per gli elementi con effetti parallax
  const headerRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  
  // Setup per gli effetti di scrolling
  const { scrollY } = useScroll()
  const headerOpacity = useTransform(scrollY, [0, 100], [1, 0.6])
  const headerScale = useTransform(scrollY, [0, 100], [1, 0.95])
  const headerY = useTransform(scrollY, [0, 100], [0, -15])
  const formY = useTransform(scrollY, [0, 300], [0, -30])
  
  // Aggiungi questi stati
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    highlight: false,
    xl: false
  });

  // Aggiungi questo stato per i link aggiuntivi
  const [additionalLinks, setAdditionalLinks] = useState<Array<{ url: string, label: string }>>([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');

  // Aggiungi questo stato
  const [isPrivate, setIsPrivate] = useState(false);

  // Aggiungi questi stati
  const [secondaryNotes, setSecondaryNotes] = useState<Array<{ id: string, content: string }>>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [overallProgress, setOverallProgress] = useState(0);

  // Add these new states below the existing ones
  const [authors, setAuthors] = useState<string[]>([]);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [newAuthor, setNewAuthor] = useState("");
  const [isAddingAuthor, setIsAddingAuthor] = useState(false);
  const authorDropdownRef = useRef<HTMLDivElement>(null);

  // Add these new states for participants
  const [participants, setParticipants] = useState<string[]>([]);
  const [newParticipant, setNewParticipant] = useState('');
  const [showParticipantsDropdown, setShowParticipantsDropdown] = useState(false);
  const participantsDropdownRef = useRef<HTMLDivElement>(null);

  // Verifica se l'utente è autorizzato
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const adminEmails = JSON.parse(process.env.NEXT_PUBLIC_ADMIN_EMAILS || "[]")
      const superiorEmails = JSON.parse(process.env.NEXT_PUBLIC_SUPERIOR_EMAILS || "[]")
      
      if (user) {
        // Verifica se l'email è verificata per gli accessi con email/password
        if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
          // Se l'email non è verificata, reindirizza alla pagina di verifica
          router.push('/verify-email');
          return;
        }
        
        // Verifica se l'utente è admin o superior
        if (adminEmails.includes(user.email || '') || superiorEmails.includes(user.email || '')) {
          setIsAdmin(true)
          
          // Set user's name as author
          const userName = user.displayName || user.email || '';
          setAutore(userName);
          
          // Fetch authors first
          try {
            const authorsRef = dbRef(db, 'autori');
            const snapshot = await get(authorsRef);
            
            if (snapshot.exists()) {
              const authorsData: string[] = [];
              snapshot.forEach((childSnapshot) => {
                authorsData.push(childSnapshot.val().name);
              });
              
              // Ordina gli autori alfabeticamente
              authorsData.sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
              setAuthors(authorsData);
              
              // If user's name is not in the authors list, add it automatically
              if (userName && !authorsData.includes(userName)) {
                const newAuthorRef = push(authorsRef);
                await set(newAuthorRef, { name: userName });
                // Aggiungi il nuovo autore e riordina l'array
                const updatedAuthors = [...authorsData, userName].sort((a, b) => 
                  a.localeCompare(b, 'it', { sensitivity: 'base' })
                );
                setAuthors(updatedAuthors);
                showNotification("success", "Autore aggiunto automaticamente");
              }
            } else {
              // If no authors exist yet, create one for the current user
              if (userName) {
                const newAuthorRef = push(authorsRef);
                await set(newAuthorRef, { name: userName });
                setAuthors([userName]);
                showNotification("success", "Autore aggiunto automaticamente");
              }
            }
          } catch (error) {
            console.error("Errore nel recupero/aggiunta degli autori:", error);
          }
        } else {
          router.push('/')
        }
      } else {
        router.push('/')
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

  // Aggiungi questo useEffect per gestire le scorciatoie da tastiera
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            handleTextFormatting('bold');
            break;
          case 'i':
            e.preventDefault();
            handleTextFormatting('italic');
            break;
          case 'u':
            e.preventDefault();
            handleTextFormatting('underline');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, []);

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
    const fileExtension = file.name.split('.').pop();
    const fileRef = storageRef(storage, `articoli/${uuid}.${fileExtension}`);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(fileRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setOverallProgress(progress * 0.5); // Image upload is 50% of the total progress
        },
        (error) => {
          console.error("Errore durante il caricamento:", error);
          if (error.code === 'storage/unauthorized') {
            reject(new Error("Non hai i permessi per caricare file. Verifica di essere autenticato e che le regole di sicurezza lo permettano."));
          } else {
            reject(new Error(`Errore durante il caricamento: ${error.message}`));
          }
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(new Error(`Errore nel recupero dell'URL: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`));
          }
        }
      );
    });
  };

  // Funzione per salvare l'articolo
  const saveArticle = async () => {
    if (!titolo || !autore || !contenuto || !selectedFile || selectedTags.length === 0) {
      showNotification("error", "Compila tutti i campi obbligatori, seleziona almeno un tag e carica un'immagine");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      showNotification("error", "Devi essere autenticato per pubblicare un articolo");
      return;
    }

    setSaving(true);
    setOverallProgress(0);

    try {
      const articleUuid = uuidv4();
      let imageUrl = "";
      try {
        imageUrl = await uploadImage(selectedFile, articleUuid);
      } catch (error) {
        showNotification("error", error instanceof Error ? error.message : "Errore durante il caricamento dell'immagine");
        setSaving(false);
        return;
      }

      const articleData: ArticleData = {
        titolo,
        autore,
        contenuto,
        immagine: imageUrl,
        tag: selectedTags.join(", "),
        partecipanti: participants.join(", "),
        additionalLinks,
        secondaryNotes,
        uuid: articleUuid,
        creazione: new Date().toISOString(),
        upvote: 0,
        shared: 0,
        view: 0,
        userId: currentUser.uid,
        isPrivate,
        status: 'revision',
      };

      try {
        const articleRef = dbRef(db, `articoli/${articleUuid}`);
        await set(articleRef, articleData);
        setOverallProgress(100); // Complete the progress
        showNotification("success", "Articolo inviato alla revisione");
        setTimeout(() => {
          router.push("/admin/review-articles");
        }, 1500);
      } catch (dbError) {
        console.error("Errore durante il salvataggio nel database:", dbError);
        showNotification("error", "Errore durante il salvataggio nel database. Verifica le regole di sicurezza.");
        setSaving(false);
      }
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
      showNotification("error", error instanceof Error ? error.message : "Si è verificato un errore durante il salvataggio");
      setSaving(false);
    }
  };

  // Gestione dei tag
  const toggleTag = (tag: string) => {
    // Convert tag to uppercase
    const upperCaseTag = tag.toUpperCase();
    
    if (selectedTags.includes(upperCaseTag)) {
      // Prevent removal if it's the last tag
      if (selectedTags.length <= 1) {
        showNotification("error", "È necessario selezionare almeno un tag");
        return;
      }
      setSelectedTags(selectedTags.filter(t => t !== upperCaseTag));
    } else {
      // Prevent adding more than 3 tags
      if (selectedTags.length >= 3) {
        showNotification("error", "Non puoi selezionare più di 3 tag");
        return;
      }
      setSelectedTags([...selectedTags, upperCaseTag]);
    }
  }

  // Funzione per inserire un'immagine nell'editor
  const insertImageInEditor = () => {
    if (imagePreview) {
      document.execCommand('insertImage', false, imagePreview);
    }
  };

  // Riscrittura completa della funzione handleTextFormatting
  const handleTextFormatting = (format: 'bold' | 'italic' | 'underline' | 'highlight' | 'xl') => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    document.execCommand('styleWithCSS', false, 'true');
    
    // Sistema di gestione uniforme per tutti i formati
    if (format === 'highlight') {
      // Caso speciale per l'evidenziazione
      const currentColor = document.queryCommandValue('backColor');
      const isHighlighted = currentColor === 'rgb(179, 89, 16)';
      document.execCommand('backColor', false, isHighlighted ? 'inherit' : '#b35910');
      setActiveFormats(prev => ({
        ...prev,
        highlight: !isHighlighted
      }));
    } else if (format === 'xl') {
      // Togliamo prima il formato per assicurarci che non rimanga attivo
      document.execCommand('fontSize', false, '3'); // Usa un valore standard
      
      // Verifica se il testo selezionato è già in XL
      const isXL = activeFormats.xl;
      
      if (isXL) {
        // Togliamo il formato grande
        document.execCommand('fontSize', false, '3'); // Ripristina dimensione normale
        document.execCommand('removeFormat', false); // Rimuove tutti i formati
        setActiveFormats(prev => ({
          ...prev,
          xl: false
        }));
      } else {
        // Applichiamo il formato grande (usa la classe in uno stile inline)
        document.execCommand('fontSize', false, '5'); // Imposta dimensione grande
        
        // Imposta anche il grassetto per rendere il testo più visibile
        document.execCommand('bold', false);
        
        setActiveFormats(prev => ({
          ...prev,
          xl: true
        }));
      }
    } else {
      // Altri formati (bold, italic, underline)
      const commands = {
        bold: 'bold',
        italic: 'italic',
        underline: 'underline'
      };
      
      document.execCommand(commands[format], false);
      setActiveFormats(prev => ({
        ...prev,
        [format]: document.queryCommandState(commands[format])
      }));
    }
    
    handleContentChange();
  };

  // Aggiorna la funzione handleContentChange per gestire meglio lo stato XL
  const handleContentChange = () => {
    const editorContent = document.getElementById('article-content');
    if (editorContent) {
      // Aggiorna il contenuto
      setContenuto(editorContent.innerHTML);
      
      // Aggiorna lo stato dei formati attivi
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        highlight: document.queryCommandValue('backColor') === 'rgb(251, 146, 60)',
        xl: document.queryCommandValue('fontSize') === '5' // Verifica se è attiva la dimensione 5
      });
    }
  };

  // Aggiungi questa funzione per gestire l'aggiunta dei link
  const handleAddLink = () => {
    if (!newLinkUrl || !newLinkLabel) {
      showNotification('error', 'Inserisci sia URL che etichetta per il link');
      return;
    }

    setAdditionalLinks([...additionalLinks, { url: newLinkUrl, label: newLinkLabel }]);
    setNewLinkUrl('');
    setNewLinkLabel('');
  };

  // Aggiungi queste funzioni per gestire le note secondarie
  const handleAddSecondaryNote = () => {
    if (!newNoteContent.trim()) {
      showNotification('error', 'La nota non può essere vuota');
      return;
    }

    const newNote = {
      id: uuidv4(),
      content: newNoteContent.trim()
    };

    setSecondaryNotes(prev => [...prev, newNote]);
    setNewNoteContent('');
    
    // Inserisci il riferimento nel testo
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const noteRef = document.createElement('sup');
      noteRef.textContent = `[${secondaryNotes.length + 1}]`;
      noteRef.className = 'note-ref';
      noteRef.dataset.noteId = newNote.id;
      
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(noteRef);
      
      // Sposta il cursore dopo la nota
      range.setStartAfter(noteRef);
      range.setEndAfter(noteRef);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleContentChange();
    }
    
    showNotification('success', 'Nota aggiunta con successo');
  };

  const handleRemoveSecondaryNote = (idToRemove: string) => {
    // Rimuovi la nota dall'array
    setSecondaryNotes(prev => prev.filter(note => note.id !== idToRemove));
    
    // Rimuovi il riferimento dal testo
    const editorContent = document.getElementById('article-content');
    if (editorContent) {
      const noteRefs = editorContent.querySelectorAll(`.note-ref[data-note-id="${idToRemove}"]`);
      noteRefs.forEach(ref => ref.remove());
      
      // Aggiorna la numerazione delle note rimaste
      const allRefs = Array.from(editorContent.querySelectorAll('.note-ref'));
      allRefs.forEach((ref, index) => {
        ref.textContent = `[${index + 1}]`;
      });
      
      handleContentChange();
    }
  };

  // Add this function to delete an author
  const handleDeleteAuthor = async (authorToDelete: string) => {
    try {
      // Find the author key in Firebase
      const authorsRef = dbRef(db, 'autori');
      const snapshot = await get(authorsRef);
      
      if (snapshot.exists()) {
        let authorKeyToDelete = null;
        
        snapshot.forEach((childSnapshot) => {
          if (childSnapshot.val().name === authorToDelete) {
            authorKeyToDelete = childSnapshot.key;
          }
        });
        
        if (authorKeyToDelete) {
          // Delete the author from Firebase
          await set(dbRef(db, `autori/${authorKeyToDelete}`), null);
          
          // Update the local state
          setAuthors(authors.filter(author => author !== authorToDelete));
          
          // If the deleted author was selected, clear the selection
          if (autore === authorToDelete) {
            setAutore("");
          }
          
          showNotification("success", "Autore eliminato con successo");
        }
      }
    } catch (error) {
      console.error("Errore nell'eliminazione dell'autore:", error);
      showNotification("error", "Errore nell'eliminazione dell'autore");
    }
  };

  // Add this function to handle author selection
  const handleSelectAuthor = (selectedAuthor: string) => {
    setAutore(selectedAuthor);
    setShowAuthorDropdown(false);
  };

  // Add this function to handle adding a new author
  const handleAddNewAuthor = async () => {
    if (!newAuthor.trim()) {
      showNotification("error", "Il nome dell'autore non può essere vuoto");
      return;
    }
    
    try {
      const authorsRef = dbRef(db, 'autori');
      const newAuthorRef = push(authorsRef);
      await set(newAuthorRef, { name: newAuthor.trim() });
      
      setAuthors([...authors, newAuthor.trim()]);
      setAutore(newAuthor.trim());
      setNewAuthor("");
      setIsAddingAuthor(false);
      setShowAuthorDropdown(false);
      
      showNotification("success", "Nuovo autore aggiunto");
    } catch (error) {
      console.error("Errore nell'aggiunta dell'autore:", error);
      showNotification("error", "Errore nell'aggiunta dell'autore");
    }
  };

  // Add click outside handler for author dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (authorDropdownRef.current && !authorDropdownRef.current.contains(event.target as Node)) {
        setShowAuthorDropdown(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Add this useEffect for handling clicks outside the participants dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (participantsDropdownRef.current && !participantsDropdownRef.current.contains(event.target as Node)) {
        setShowParticipantsDropdown(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Add this function to handle adding participants
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

  // Add this function to handle removing participants
  const handleRemoveParticipant = (participantToRemove: string) => {
    setParticipants(participants.filter(p => p !== participantToRemove));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200/90 dark:from-zinc-900 dark:to-zinc-800">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
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
        <motion.div 
          ref={headerRef}
          className="text-center mb-10"
          style={{ 
            opacity: headerOpacity, 
            scale: headerScale,
            y: headerY 
          }}
        >
          <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Crea un nuovo articolo
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-300 text-sm sm:text-base">
            Compila tutti i campi per creare un nuovo articolo
          </p>
        </motion.div>
        
        {/* Form con effetto parallax */}
        <motion.div 
          ref={formRef}
          style={{ y: formY }}
          className="backdrop-blur-xl bg-white/15 dark:bg-zinc-800/20 border border-white/30 dark:border-white/10 rounded-2xl shadow-2xl p-8 transition-all duration-500 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_20px_60px_-15px_rgba(255,255,255,0.1)]"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Titolo - with 100 character limit */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Titolo * <span className="text-xs text-zinc-500">(max 100 caratteri)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={titolo}
                  onChange={(e) => {
                    // Limit to 100 characters
                    if (e.target.value.length <= 100) {
                      setTitolo(e.target.value);
                    }
                  }}
                  maxLength={100}
                  className="w-full p-4 bg-white/5 border border-white/20 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                  placeholder="Inserisci il titolo dell'articolo"
                  required
                />
                <div className="absolute right-3 bottom-3 text-xs text-zinc-500">
                  {titolo.length}/100
                </div>
              </div>
            </div>
            
            {/* Autore - as a dropdown with option to add new */}
            <div className="relative" ref={authorDropdownRef}>
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
                    {autore || "Seleziona un autore"}
                  </div>
                  <FiChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${showAuthorDropdown ? 'rotate-180' : ''}`} />
                </div>
                
                {/* Dropdown for author selection */}
                {showAuthorDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 max-h-60 overflow-auto animate-fade-in">
                    {/* Option to add new author */}
                    {isAddingAuthor ? (
                      <div className="p-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newAuthor}
                            onChange={(e) => setNewAuthor(e.target.value)}
                            placeholder="Nome del nuovo autore"
                            className="flex-1 p-2 bg-white/5 border border-white/20 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                            autoFocus
                          />
                          <button
                            onClick={handleAddNewAuthor}
                            className="cursor-pointer px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          >
                            <FiCheck className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setIsAddingAuthor(false)}
                            className="cursor-pointer px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          >
                            <FiX className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="flex items-center px-3 py-2 cursor-pointer hover:bg-green-500/10 text-green-600 dark:text-green-400"
                        onClick={() => setIsAddingAuthor(true)}
                      >
                        <div className="flex-shrink-0 h-4 w-4 mr-2 flex items-center justify-center">
                          <FiPlus className="h-4 w-4" />
                        </div>
                        <span className="text-sm">Aggiungi nuovo autore</span>
                      </div>
                    )}
                    
                    {/* Divider */}
                    {authors.length > 0 && (
                      <div className="border-t border-zinc-200 dark:border-zinc-700 my-1"></div>
                    )}
                    
                    {/* List of existing authors */}
                    {authors.map((author, index) => (
                      <div 
                        key={index}
                        className={`flex items-center px-3 py-2 cursor-pointer hover:bg-blue-500/10 ${
                          autore === author ? 'bg-blue-500/20' : ''
                        }`}
                        onClick={() => handleSelectAuthor(author)}
                      >
                        <div className={`flex-shrink-0 h-4 w-4 mr-2 rounded ${
                          autore === author ? 'bg-blue-500 flex items-center justify-center' : ''
                        }`}>
                          {autore === author && (
                            <FiCheck className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-zinc-800 dark:text-zinc-200 flex-grow">{author}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAuthor(author);
                          }}
                          className="text-zinc-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                          title="Elimina autore"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    
                    {authors.length === 0 && !isAddingAuthor && (
                      <div className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                        Nessun autore disponibile
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Tag - Selezione multipla (limited to 3) */}
            <div className="relative" ref={tagDropdownRef}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Tag * <span className="text-xs text-zinc-500">(max 3 categorie)</span>
              </label>
              <div className="relative">
                <div 
                  className="flex items-center w-full p-3 bg-white/5 border border-white/20 rounded-xl focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none cursor-pointer"
                  onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                >
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                    <FiTag className="h-5 w-5" />
                  </div>
                  <div className="pl-10 flex-grow flex flex-wrap gap-2">
                    {selectedTags.length > 0 ? (
                      selectedTags.map(tag => (
                        <span 
                          key={tag} 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-zinc-500">Seleziona da 1 a 3 categorie</span>
                    )}
                  </div>
                  <div className="ml-auto text-xs text-zinc-500 flex items-center gap-1">
                    {selectedTags.length}/3
                    <FiChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-300 ${showTagsDropdown ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                
                {/* Dropdown for tag selection */}
                {showTagsDropdown && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 max-h-60 overflow-auto animate-fade-in">
                    {/* Helpful info message */}
                    <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                      Seleziona da 1 a 3 categorie per il tuo articolo
                    </div>
                    
                    {/* List of available tags */}
                    {availableCategories.map((tag) => (
                      <div 
                        key={tag}
                        className={`flex items-center px-3 py-2 cursor-pointer hover:bg-blue-500/10 ${
                          selectedTags.includes(tag) ? 'bg-blue-500/20' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTag(tag);
                        }}
                      >
                        <div className={`flex-shrink-0 h-4 w-4 mr-2 rounded ${
                          selectedTags.includes(tag) ? 'bg-blue-500 flex items-center justify-center' : 'border border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {selectedTags.includes(tag) && (
                            <FiCheck className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-zinc-800 dark:text-zinc-200">{tag}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Partecipanti - improved version */}
            <div className="relative" ref={participantsDropdownRef}>
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
            
            {/* Toggle per la visibilità dell'articolo */}
            <div className="md:col-span-2 flex items-center justify-between p-4 bg-white/5 dark:bg-zinc-800/20 rounded-xl border border-white/10 dark:border-zinc-700/50">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Visibilità articolo
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {isPrivate 
                    ? "Solo gli utenti registrati potranno vedere questo articolo" 
                    : "L'articolo sarà visibile a tutti"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 cursor-pointer focus:outline-none
                  ${isPrivate 
                    ? 'bg-amber-500' 
                    : 'bg-zinc-300 dark:bg-zinc-600'}`}
              >
                <span className="sr-only">
                  Toggle article visibility
                </span>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300
                    ${isPrivate ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
            
            {/* Contenuto */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Contenuto *
              </label>
              
              {/* Barra degli strumenti */}
              <div className="mb-2 flex gap-2 sticky top-0 bg-zinc-900/80 backdrop-blur-sm p-2 rounded-lg z-10">
                <button
                  type="button"
                  onClick={() => handleTextFormatting('bold')}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    activeFormats.bold 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                  title="Grassetto (Ctrl+B)"
                >
                  <span className="font-bold">B</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTextFormatting('italic')}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    activeFormats.italic 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                  title="Corsivo (Ctrl+I)"
                >
                  <span className="italic">I</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTextFormatting('underline')}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    activeFormats.underline 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                  title="Sottolineato (Ctrl+U)"
                >
                  <span className="underline">U</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTextFormatting('highlight')}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    activeFormats.highlight 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                  title="Evidenzia"
                >
                  <span className={`px-1 ${
                    activeFormats.highlight
                      ? 'text-white'
                      : 'bg-amber-400/30 text-amber-600 dark:text-amber-400'
                  }`}>H</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTextFormatting('xl')}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    activeFormats.xl 
                      ? 'bg-amber-500 text-white' 
                      : 'bg-zinc-800/50 hover:bg-zinc-800'
                  }`}
                  title="Testo Grande"
                >
                  <span className={`text-lg font-bold ${
                    activeFormats.xl
                      ? 'text-white'
                      : 'text-zinc-400'
                  }`}>XL</span>
                </button>
              </div>

              {/* Editor WYSIWYG */}
              <div
                id="article-content"
                contentEditable
                onInput={handleContentChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    document.execCommand('insertParagraph', false);
                  }
                }}
                className={`
                  min-h-[300px] w-full p-4 bg-white/5 border border-white/20 rounded-xl 
                  focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                  transition-all duration-300 text-zinc-900 dark:text-zinc-50 
                  outline-none font-montserrat overflow-auto
                  prose prose-zinc dark:prose-invert max-w-none
                  [&>p]:mb-4 [&>p]:leading-relaxed [&>p]:tracking-wide
                  [&_a]:text-amber-500 [&_a]:no-underline [&_a]:cursor-pointer
                  [&_a:hover]:text-amber-600 
                  dark:[&_a]:text-amber-500 
                  dark:[&_a:hover]:text-amber-600
                  [&_a]:transition-colors [&_a]:duration-200
                  [&_a]:pointer-events-auto
                  [&_[style*='background-color: rgb(251, 146, 60)']]:text-zinc-900
                  [&_[style*='background-color: rgb(251, 146, 60)']]:bg-amber-500
                  [&_font[size='5']]:text-2xl
                  [&_font[size='5']]:font-semibold
                  [&_font[size='5']]:leading-relaxed
                  [&_font[size='5']]:tracking-wide
                  [&_font[size='5']]:block
                  [&_font[size='5']]:my-4
                `}
                data-placeholder="Inizia a scrivere il tuo articolo..."
              />
              
              <p className="mt-2 text-xs text-zinc-500">
                Usa i pulsanti sopra o le scorciatoie da tastiera per formattare il testo. 
                Premi Enter per un nuovo paragrafo, Shift+Enter per una nuova riga.
              </p>
            </div>

            {/* Note secondarie */}
            <div className="md:col-span-2 mt-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Note secondarie
              </label>
              <div className="space-y-4">
                {/* Form per aggiungere nuove note */}
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
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

                {/* Lista delle note aggiunte */}
                {secondaryNotes.length > 0 && (
                  <div className="p-4 bg-white/5 border border-white/20 rounded-xl">
                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                      Note inserite ({secondaryNotes.length})
                    </h4>
                    <div className="space-y-3">
                      {secondaryNotes.map((note, index) => (
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

                <p className="text-xs text-zinc-500">
                  Le note secondarie appariranno in fondo all&apos;articolo e saranno riferite nel testo come [1], [2], ecc.
                </p>
              </div>
            </div>

            {/* Link aggiuntivi */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Link aggiuntivi
              </label>
              <div className="space-y-4">
                {/* Form per aggiungere nuovi link */}
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    placeholder="Etichetta del link"
                    className="flex-1 p-2 bg-white/5 border border-white/20 rounded-lg focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-300 text-zinc-900 dark:text-zinc-50 outline-none"
                  />
                  <input
                    type="url"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
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

                {/* Lista dei link aggiunti */}
                {additionalLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-4 bg-white/5 border border-white/20 rounded-lg">
                    {additionalLinks.map((link, index) => (
                      <div key={index} className="flex items-center gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full">
                        <span>{link.label}</span>
                        <button
                          onClick={() => {
                            setAdditionalLinks(additionalLinks.filter((_, i) => i !== index));
                          }}
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

            {/* Caricamento immagine - SPOSTATO QUI */}
            <div className="md:col-span-2 relative">
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
                
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Area caricamento */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-grow p-6 bg-white/5 dark:bg-zinc-800/20 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-300 cursor-pointer flex items-center justify-center"
                  >
                    <div className="text-center">
                      <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-3">
                        <FiUpload className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                      </div>
                      
                      <div className="flex-1">
                        {selectedFile ? (
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{selectedFile.name}</span>
                        ) : (
                          <>
                            <p className="text-zinc-800 dark:text-zinc-300 font-medium">Clicca per caricare</p>
                            <p className="text-xs text-zinc-500 mt-1">SVG, PNG, JPG o GIF (max. 5MB)</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Anteprima immagine */}
                  {imagePreview && (
                    <div className="relative w-full sm:w-1/3 h-48 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-md">
                      <img 
                        src={imagePreview} 
                        alt="Anteprima" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            insertImageInEditor();
                          }}
                          className="bg-blue-500 text-white rounded-full p-1 shadow-lg hover:bg-blue-600 transition-colors"
                          title="Inserisci nell'editor"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setImagePreview(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                          className="bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
                          title="Rimuovi immagine"
                        >
                          <FiX className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Pulsante di salvataggio con barra di avanzamento integrata */}
          <div className="mt-8">
            <div className="relative">
              <Button
                variant="solid"
                className={`w-full py-4 px-8 bg-gradient-to-r rounded-xl from-amber-500 to-orange-600 text-white shadow-lg cursor-pointer transition-all duration-500 ease-in-out hover:opacity-90 hover:shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02] text-base font-medium tracking-wide ${
                  saving ? "opacity-70" : ""
                }`}
                onClick={saveArticle}
                disabled={saving}
              >
                <div className="flex items-center justify-center gap-2">
                  <FiSave className="h-5 w-5" />
                  {saving ? "Invio in corso..." : "Manda a revisione"}
                </div>
              </Button>

              {/* Barra di avanzamento sovrapposta */}
              {saving && (
                <div className="absolute left-0 bottom-0 w-full h-1 bg-zinc-200/20 rounded-b-xl overflow-hidden">
                  <div 
                    className="h-full bg-white/30 transition-all duration-300 ease-out"
                    style={{ 
                      width: `${overallProgress}%`,
                      backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0.3))',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Percentuale di avanzamento */}
            {saving && overallProgress > 0 && (
              <div className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Avanzamento: {overallProgress}%
              </div>
            )}
          </div>
        </motion.div>
        
        {/* Informazioni aggiuntive */}
        <div className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
          <p>I campi contrassegnati con * sono obbligatori</p>
          <p className="mt-1">L&apos;articolo sarà inviato a revisione prima di essere pubblicato</p>
        </div>
      </div>
    </main>
  )
} 