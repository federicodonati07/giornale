"use client"

import { useEffect } from "react"
import { ref, get, update } from "firebase/database"
import { db } from "../firebase"

export default function ScheduledArticlesChecker() {
  useEffect(() => {
    const checkScheduledArticles = async () => {
      try {
        const articlesRef = ref(db, 'articoli');
        const snapshot = await get(articlesRef);
        
        if (snapshot.exists()) {
          const now = new Date();
          const updates: Record<string, unknown> = {};
          let hasUpdates = false;
          
          snapshot.forEach((childSnapshot) => {
            const article = childSnapshot.val();
            const articleId = childSnapshot.key;
            
            if (article.status === 'scheduled' && article.scheduleDate) {
              const scheduleDate = new Date(article.scheduleDate);
              
              if (scheduleDate <= now) {
                updates[`articoli/${articleId}/status`] = 'accepted';
                updates[`articoli/${articleId}/scheduleDate`] = null;
                hasUpdates = true;
                console.log(`Articolo programmato pubblicato: ${article.titolo}`);
              }
            }
          });
          
          if (hasUpdates) {
            await update(ref(db), updates);
            console.log('Articoli programmati aggiornati con successo');
          }
        }
      } catch (error) {
        console.error('Errore durante la verifica degli articoli programmati:', error);
      }
    };
    
    // Esegui subito e imposta un intervallo
    checkScheduledArticles();
    const interval = setInterval(checkScheduledArticles, 60000); // Ogni minuto
    
    return () => clearInterval(interval);
  }, []);

  // Componente invisibile - non renderizza nulla
  return null;
} 