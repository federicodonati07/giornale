"use client"

import { useState, useEffect } from "react"
import { Card } from "@heroui/react"
import Image from "next/image"
import { ref, get, query, limitToLast } from "firebase/database"
import { db } from "../firebase"

interface ArticleData {
  uuid: string
  titolo: string
  contenuto: string
  tag: string
  immagine: string
  autore: string
  creazione: string
}

export function FeaturedNews() {
  const [articles, setArticles] = useState<ArticleData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        // Riferimento alla collezione articoli
        const articlesRef = ref(db, 'articoli')
        
        // Crea una query per ottenere gli ultimi 5 articoli
        // Nota: orderByChild richiede un indice nel database
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
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength).trim() + '...'
  }

  return (
    <section className="w-full py-4 sm:py-6">
      <h2 className="text-xl md:text-2xl font-serif font-bold text-center mb-4 text-zinc-900 dark:text-zinc-50">
        Notizie in Evidenza
      </h2>
      
      {loading ? (
        // Stato di caricamento
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 px-2 max-w-full mx-auto">
          {[...Array(5)].map((_, index) => (
            <Card key={index} className="relative overflow-hidden rounded-lg bg-white/10 dark:bg-zinc-800/30 border border-white/20">
              <div className="h-32 sm:h-40 bg-zinc-300/20 animate-pulse"></div>
              <div className="p-3">
                <div className="h-4 bg-zinc-300/20 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-zinc-300/20 rounded animate-pulse w-3/4"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : articles.length > 0 ? (
        // Visualizza gli articoli
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 px-2 max-w-full mx-auto">
          {articles.map((article) => (
            <Card 
              key={article.uuid}
              className="group relative overflow-hidden rounded-lg backdrop-blur-sm bg-white/10 dark:bg-zinc-800/30 border border-white/20 hover:border-white/40 transition-all duration-500 ease-out hover:shadow-2xl hover:shadow-white/10 cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/30 dark:from-white/5 dark:to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative h-32 sm:h-40 overflow-hidden">
                <Image
                  src={article.immagine}
                  alt={article.titolo}
                  fill
                  className="object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out"
                  onError={(e) => {
                    // Fallback per immagini che non possono essere caricate
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-image.jpg'; // Immagine di fallback
                    console.error(`Errore nel caricamento dell'immagine: ${article.immagine}`);
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 max-w-[90%]">
                  {article.tag?.split(',').map((tag, index) => (
                    <span 
                      key={index} 
                      className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full border border-blue-200 dark:border-blue-800 shadow-sm backdrop-blur-md transition-all duration-300 group-hover:bg-blue-200 dark:group-hover:bg-blue-800"
                    >
                      {tag.trim() || 'GENERALE'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 relative z-10">
                <h3 className="font-medium text-sm lg:text-base mb-1 text-zinc-900 dark:text-zinc-50 line-clamp-2 group-hover:text-white transition-colors duration-500">
                  {article.titolo}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 group-hover:text-white/80 transition-colors duration-500">
                  {getExcerpt(article.contenuto)}
                </p>
                <p className="text-xs italic text-zinc-500 dark:text-zinc-400 mt-2 group-hover:text-white/70 transition-colors duration-500">
                  di {article.autore}
                </p>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-white/5 to-transparent dark:from-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </Card>
          ))}
        </div>
      ) : (
        // Nessun articolo trovato
        <div className="text-center py-8">
          <p className="text-zinc-600 dark:text-zinc-400">Nessun articolo disponibile al momento.</p>
        </div>
      )}
    </section>
  )
} 