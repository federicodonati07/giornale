"use client";

import { useEffect } from "react";
import ErrorPage from "./components/ErrorPage";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorPage 
      title="Si è verificato un errore"
      message="Ci scusiamo per l'inconveniente. Abbiamo riscontrato un problema durante l'elaborazione della tua richiesta."
      showHomeButton={true}
      showRetryButton={true}
      onRetry={reset}
    />
  );
} 