import { useState, useEffect } from 'react';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const documentChangeHandler = () => setMatches(mediaQueryList.matches);

    // Initial check
    documentChangeHandler();

    // Listen for changes
    try {
      mediaQueryList.addEventListener('change', documentChangeHandler);
    } catch (e) {
      // For older browsers that don't support addEventListener
      mediaQueryList.addListener(documentChangeHandler);
    }

    return () => {
      try {
        mediaQueryList.removeEventListener('change', documentChangeHandler);
      } catch (e) {
        // For older browsers that don't support removeEventListener
        mediaQueryList.removeListener(documentChangeHandler);
      }
    };
  }, [query]);

  return matches;
}

export default useMediaQuery; 