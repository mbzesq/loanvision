// src/frontend/src/components/StreetViewPanorama.tsx
import React, { useEffect, useRef, useState } from 'react';
import useGoogleMapsScript from '../hooks/useGoogleMapsScript';

interface StreetViewPanoramaProps {
  lat: number;
  lng: number;
}

const StreetViewPanorama: React.FC<StreetViewPanoramaProps> = ({ lat, lng }) => {
  const apiKey = import.meta.env.VITE_Maps_API_KEY || '';
  const isGoogleScriptLoaded = useGoogleMapsScript(apiKey);
  const panoramaRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isGoogleScriptLoaded && panoramaRef.current && window.google?.maps) {
      try {
        const streetViewService = new window.google.maps.StreetViewService();
        
        // Check if Street View is available at this location
        streetViewService.getPanorama({
          location: { lat, lng },
          radius: 50
        }, (data, status) => {
          if (status === window.google.maps.StreetViewStatus.OK) {
            // Street View is available, create panorama
            new window.google.maps.StreetViewPanorama(
              panoramaRef.current!,
              {
                position: { lat, lng },
                pov: { heading: 34, pitch: 10 },
                visible: true,
                zoomControl: true,
                panControl: true,
                addressControl: false,
                fullscreenControl: false,
                motionTracking: false,
                motionTrackingControl: false
              }
            );
            setError(null);
          } else {
            console.warn('Street View not available at this location:', status);
            setError('Street View not available at this location');
          }
        });
      } catch (err) {
        console.error('Error initializing Street View:', err);
        setError('Error loading Street View');
      }
    }
  }, [isGoogleScriptLoaded, lat, lng]);

  if (!apiKey) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        backgroundColor: 'var(--color-surface)', 
        borderRadius: '4px',
        color: 'var(--color-text-muted)'
      }}>
        Google Maps API key is missing. Please check your environment configuration.
      </div>
    );
  }

  if (!isGoogleScriptLoaded) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        backgroundColor: 'var(--color-surface)', 
        borderRadius: '4px',
        color: 'var(--color-text-muted)'
      }}>
        Loading Street View...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        backgroundColor: 'var(--color-surface)', 
        borderRadius: '4px',
        color: 'var(--color-text-muted)'
      }}>
        {error}
      </div>
    );
  }

  return <div ref={panoramaRef} style={{ width: '100%', height: '300px', borderRadius: '4px' }} />;
};

export default StreetViewPanorama;