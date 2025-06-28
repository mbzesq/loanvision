// Type declarations for Google Maps API
declare global {
  interface Window {
    google: {
      maps: {
        StreetViewPanorama: new (
          element: HTMLElement,
          options: {
            position: { lat: number; lng: number };
            pov: { heading: number; pitch: number };
            visible: boolean;
          }
        ) => any;
      };
    };
  }
}

export {};