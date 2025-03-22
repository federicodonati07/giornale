import { NextResponse } from "next/server";
import { initAdminSDK } from "@/lib/firebase-admin";

// Aggiungo questa opzione per evitare il caching dell'API
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let adminAuth;
    try {
      // Inizializza l'Admin SDK
      adminAuth = initAdminSDK().auth();
    } catch (initError) {
      console.error("Errore di inizializzazione Firebase Admin:", initError);
      return NextResponse.json(
        {
          error: "Errore di configurazione del server",
          message:
            initError instanceof Error
              ? initError.message
              : "Errore sconosciuto",
          success: false,
        },
        { status: 500 }
      );
    }

    // Ottieni gli utenti
    console.log("Tentativo di recupero utenti da Firebase Auth...");
    const userRecords = await adminAuth.listUsers(1000);
    console.log(`Recuperati ${userRecords.users.length} utenti con successo`);

    // Restituisci il conteggio
    return NextResponse.json({
      count: userRecords.users.length,
      success: true,
    });
  } catch (error) {
    // Registra l'errore completo nel log del server
    console.error("Errore nel recupero del conteggio utenti:", error);

    // Prepara un messaggio di errore dettagliato
    let errorMessage = "Errore sconosciuto";
    if (error instanceof Error) {
      errorMessage = error.message;
      // Aggiungi lo stack trace nei log, ma non nella risposta
      console.error("Stack trace:", error.stack);
    }

    return NextResponse.json(
      {
        error: "Errore nel recupero del conteggio utenti",
        message: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}
