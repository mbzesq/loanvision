// src/frontend/src/components/StreetViewPanorama.tsx
import React, { useEffect, useRef } from 'react';
import useGoogleMapsScript from '../hooks/useGoogleMapsScript';

interface StreetViewPanoramaProps {
  lat: number;
  lng: number;
}

const StreetViewPanorama: React.FC<StreetViewPanoramaProps> = ({ lat, lng }) => {
  const apiKey = import.meta.env.VITE_Maps_API_KEY || '';
  const isGoogleScriptLoaded = useGoogleMapsScript(apiKey);
  const panoramaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isGoogleScriptLoaded && panoramaRef.current) {
      new window.google.maps.StreetViewPanorama(
        panoramaRef.current,
        {
          position: { lat, lng },
          pov: { heading: 34, pitch: 10 },
          visible: true,
        }
      );
    }
  }, [isGoogleScriptLoaded, lat, lng]);

  if (!apiKey) return <div>API key is missing.</div>;
  if (!isGoogleScriptLoaded) return <div>Loading Street View...</div>;

  return <div ref={panoramaRef} style={{ width: '100%', height: '300px' }} />;
};

export default StreetViewPanorama;