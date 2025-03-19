"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ref, get, query, limitToLast } from "firebase/database"
import { db } from "../firebase"
import { FiHeart, FiShare2, FiEye, FiClock } from "react-icons/fi"
import Link from "next/link"

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
}

export function FeaturedNews() {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch articles from Firebase
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        // Riferimento alla collezione articoli
        const articlesRef = ref(db, 'articoli')
        
        // Crea una query per ottenere gli ultimi 5 articoli
        const articlesQuery = query(articlesRef, limitToLast(5))
        
        // Esegui la query
        const snapshot = await get(articlesQuery)
        
        if (snapshot.exists()) {
          const articlesData: ArticleData[] = []
          
          // Converti lo snapshot in un array di articoli
          snapshot.forEach((childSnapshot) => {
            articlesData.push({
              uuid: childSnapshot.key || '',
              ...childSnapshot.val()
            })
          })
          
          // Ordina gli articoli per data di creazione (dal più recente)
          articlesData.sort((a, b) => 
            new Date(b.creazione).getTime() - new Date(a.creazione).getTime()
          )
          
          setArticles(articlesData)
        }
      } catch (error) {
        console.error("Errore nel recupero degli articoli:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchArticles()
  }, [])

  // Funzione per estrarre un excerpt dal contenuto
  const getExcerpt = (content: string, maxLength: number = 100) => {
    // Gestione lato client per evitare errori SSR
    if (typeof document === 'undefined') {
      // Fallback semplice per il server
      return content.substring(0, maxLength) + '...';
    }
    
    // Crea un elemento temporaneo per rimuovere i tag HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    if (textContent.length <= maxLength) return textContent;
    
    return textContent.substring(0, maxLength) + '...';
  }

  // Format the time difference
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'} fa`;
    } else if (diffHours > 0) {
      return `${diffHours} ${diffHours === 1 ? 'ora' : 'ore'} fa`;
    } else if (diffMins > 0) {
      return `${diffMins} ${diffMins === 1 ? 'minuto' : 'minuti'} fa`;
    } else {
      return 'adesso';
    }
  };

  return (
    <section className="w-full py-4 sm:py-8">
      <style jsx global>{`
        @keyframes slideUp {
          0% {
            opacity: 0;
            transform: translateY(30px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .card-animate {
          animation: slideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          opacity: 0;
        }
        
        .card-animate:nth-child(1) { animation-delay: 0.1s; }
        .card-animate:nth-child(2) { animation-delay: 0.2s; }
        .card-animate:nth-child(3) { animation-delay: 0.3s; }
        .card-animate:nth-child(4) { animation-delay: 0.4s; }
        .card-animate:nth-child(5) { animation-delay: 0.5s; }
      `}</style>

      <div className="flex flex-col items-center space-y-2 mb-8">
        <h2 className="text-xl md:text-2xl font-serif font-bold text-center text-zinc-900 dark:text-zinc-50">
          Notizie in Evidenza
        </h2>
        <Link 
          href="/articles" 
          className="group inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-amber-400 dark:hover:text-amber-400 transition-colors duration-300"
        >
          Tutti gli articoli
          <svg 
            className="ml-1 w-4 h-4 transform transition-transform duration-300 group-hover:translate-x-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
      
      {loading ? (
        // Stato di caricamento moderno
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 max-w-7xl mx-auto">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="flex flex-col rounded-xl overflow-hidden bg-white/5 dark:bg-zinc-800/20 backdrop-blur-md border border-white/10 dark:border-white/5 shadow-xl h-[400px] animate-pulse">
              <div className="h-48 bg-gradient-to-r from-zinc-200/20 to-zinc-300/20 dark:from-zinc-700/30 dark:to-zinc-600/30"></div>
              <div className="p-6 flex flex-col gap-4">
                <div className="h-4 bg-zinc-200/30 dark:bg-zinc-700/30 rounded-full w-3/4"></div>
                <div className="h-3 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full w-full"></div>
                <div className="h-3 bg-zinc-200/20 dark:bg-zinc-700/20 rounded-full w-5/6"></div>
                <div className="mt-auto flex justify-between">
                  <div className="h-3 bg-zinc-200/30 dark:bg-zinc-700/30 rounded-full w-1/4"></div>
                  <div className="h-3 bg-zinc-200/30 dark:bg-zinc-700/30 rounded-full w-1/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : articles.length > 0 ? (
        <>
          {/* Desktop view - grid layout */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 px-4 max-w-7xl mx-auto">
            {articles.slice(0, 3).map((article) => (
              <Link 
                href={`/article/${article.uuid}`}
                key={article.uuid}
                className="card-animate block group relative cursor-pointer bg-white/5 dark:bg-zinc-800/20 hover:bg-white/10 dark:hover:bg-zinc-800/30 backdrop-blur-lg border border-white/10 dark:border-white/5 rounded-xl shadow-xl overflow-hidden transition-all duration-300"
              >
                {/* Immagine principale */}
                <div className="relative w-full h-48 overflow-hidden">
                  <Image
                    src={article.immagine}
                    alt={article.titolo}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-image.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-70 transition-opacity" />
                  
                  {/* Tags con design moderno */}
                  <div className="absolute top-3 right-3 flex flex-wrap gap-2 justify-end max-w-[90%]">
                    {article.tag?.split(',').map((tag, idx) => (
                      <span 
                        key={idx} 
                        className="px-3 py-1 text-[10px] font-medium bg-amber-500/90 text-white rounded-full shadow-lg backdrop-blur-md transition-transform duration-300 group-hover:scale-105"
                      >
                        {tag.trim() || 'GENERALE'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Contenuto testuale */}
                <div className="p-6 flex flex-col gap-3">
                  {/* Titolo */}
                  <h3 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-50 line-clamp-2 group-hover:text-amber-500 transition-colors duration-300">
                    {article.titolo}
                  </h3>
                  
                  {/* Estratto */}
                  <p className="font-['Inter'] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-3">
                    {getExcerpt(article.contenuto, 120)}
                  </p>

                  {/* Footer con autore, tempo e metriche */}
                  <div className="flex flex-col gap-3 mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                        di {article.autore}
                      </span>
                      <span className="flex items-center text-zinc-400 dark:text-zinc-500">
                        <FiClock className="mr-1 h-3 w-3" />
                        {getTimeAgo(article.creazione)}
                      </span>
                    </div>
                    
                    {/* Metriche di interazione con badge moderni - Desktop */}
                    <div className="flex items-center justify-end gap-3 text-xs">
                      <span className="flex items-center px-2 py-1 bg-rose-500/10 text-rose-500 rounded-full">
                        <FiHeart className="mr-1 h-3 w-3" />
                        {article.upvote || 0}
                      </span>
                      <span className="flex items-center px-2 py-1 bg-blue-500/10 text-blue-500 rounded-full">
                        <FiEye className="mr-1 h-3 w-3" />
                        {article.view || 0}
                      </span>
                      <span className="flex items-center px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-full">
                        <FiShare2 className="mr-1 h-3 w-3" />
                        {article.shared || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {/* Mobile view */}
          <div className="md:hidden px-4 space-y-4">
            {articles.slice(0, 3).map((article) => (
              <Link 
                href={`/article/${article.uuid}`}
                key={article.uuid}
                className="card-animate block group relative cursor-pointer bg-white/5 dark:bg-zinc-800/20 hover:bg-white/10 dark:hover:bg-zinc-800/30 backdrop-blur-lg border border-white/10 dark:border-white/5 rounded-xl shadow-xl overflow-hidden transition-all duration-300"
              >
                <div className="flex gap-4 p-4">
                  {/* Immagine a sinistra */}
                  <div className="relative w-[140px] h-[140px] flex-shrink-0 rounded-lg overflow-hidden">
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
                    <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
                  </div>

                  {/* Contenuto a destra */}
                  <div className="flex flex-col flex-1 min-w-0">
                    {/* Tag */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {article.tag?.split(',').map((tag, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/90 text-white rounded-full"
                        >
                          {tag.trim() || 'GENERALE'}
                        </span>
                      ))}
                    </div>

                    {/* Titolo */}
                    <h3 className="font-serif text-sm font-bold text-zinc-900 dark:text-zinc-50 line-clamp-2 mb-1 group-hover:text-amber-500 transition-colors duration-300">
                      {article.titolo}
                    </h3>

                    {/* Estratto */}
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-3">
                      {getExcerpt(article.contenuto, 100)}
                    </p>

                    {/* Footer con autore, tempo e metriche */}
                    <div className="flex items-center justify-between mt-auto text-[10px]">
                      <div className="flex flex-col">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                          di {article.autore}
                        </span>
                        <span className="flex items-center text-zinc-400 dark:text-zinc-500 mt-0.5">
                          <FiClock className="mr-1 h-2.5 w-2.5" />
                          {getTimeAgo(article.creazione)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {/* Metriche per mobile */}
                        <span className="flex items-center px-1.5 py-0.5 bg-rose-500/10 text-rose-500 rounded-full">
                          <FiHeart className="mr-0.5 h-2.5 w-2.5" />
                          {article.upvote || 0}
                        </span>
                        <span className="flex items-center px-1.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full">
                          <FiEye className="mr-0.5 h-2.5 w-2.5" />
                          {article.view || 0}
                        </span>
                        <span className="flex items-center px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded-full">
                          <FiShare2 className="mr-0.5 h-2.5 w-2.5" />
                          {article.shared || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        // Nessun articolo trovato - versione moderna
        <div className="text-center py-12 px-4">
          <div className="max-w-lg mx-auto p-8 rounded-2xl bg-white/20 dark:bg-zinc-800/40 backdrop-blur-lg border border-white/30 dark:border-white/10 shadow-lg">
            <p className="text-zinc-600 dark:text-zinc-400">Nessun articolo disponibile al momento.</p>
          </div>
        </div>
      )}
    </section>
  )
} 