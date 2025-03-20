import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Inizializza l'Admin SDK di Firebase se non è già stato inizializzato
export function initAdminSDK() {
  try {
    if (getApps().length === 0) {
      // Verifica che FIREBASE_SERVICE_ACCOUNT_KEY esista
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.error("FIREBASE_SERVICE_ACCOUNT_KEY non è configurata");
        throw new Error(
          "Manca la variabile d'ambiente FIREBASE_SERVICE_ACCOUNT_KEY"
        );
      }

      // Verifica che NEXT_PUBLIC_FIREBASE_DATABASE_URL esista
      if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
        console.error("NEXT_PUBLIC_FIREBASE_DATABASE_URL non è configurata");
        throw new Error(
          "Manca la variabile d'ambiente NEXT_PUBLIC_FIREBASE_DATABASE_URL"
        );
      }

      // Tenta di analizzare il JSON
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (error) {
        console.error(
          "Errore nel parsing del JSON di FIREBASE_SERVICE_ACCOUNT_KEY",
          error
        );
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_KEY contiene un JSON non valido"
        );
      }

      // Verifica che il JSON contenga i campi necessari
      if (
        !serviceAccount.project_id ||
        !serviceAccount.private_key ||
        !serviceAccount.client_email
      ) {
        console.error(
          "FIREBASE_SERVICE_ACCOUNT_KEY non contiene tutti i campi necessari"
        );
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY non valida");
      }

      initializeApp({
        credential: cert(serviceAccount),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      });
    }

    return {
      auth: getAuth,
    };
  } catch (error) {
    console.error("Errore nell'inizializzazione di Firebase Admin SDK:", error);
    // Restituiamo un oggetto con una funzione auth che genererà un errore se chiamata
    // Questo ci permette di gestire meglio l'errore nella route API
    return {
      auth: () => {
        throw error;
      },
    };
  }
}
