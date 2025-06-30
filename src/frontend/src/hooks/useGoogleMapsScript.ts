// src/frontend/src/hooks/useGoogleMapsScript.ts
import { useState, useEffect } from 'react';

// Extend the Window interface to avoid TypeScript errors
declare global {
  interface Window {
    googleMapsScriptLoaded?: boolean;
  }
}

const useGoogleMapsScript = (apiKey: string) => {
  const [isLoaded, setIsLoaded] = useState(window.googleMapsScriptLoaded || false);

  useEffect(() => {
    // If the script is already loaded or is in the process of loading, do nothing.
    if (window.googleMapsScriptLoaded) {
      setIsLoaded(true);
      return;
    }

    // Prevent adding the script multiple times on fast re-renders
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      return;
    }

    window.googleMapsScriptLoaded = false; // Set a flag to indicate loading has started
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setIsLoaded(true);
      window.googleMapsScriptLoaded = true;
    };

    script.onerror = () => {
      // In case of error, reset the flag
      window.googleMapsScriptLoaded = false; 
    };

    document.head.appendChild(script);

  }, [apiKey]);

  return isLoaded;
};

export default useGoogleMapsScript;