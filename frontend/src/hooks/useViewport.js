import { useState, useEffect } from 'react';

function getState() {
  const w = window.innerWidth;
  return {
    width: w,
    isMobile:  w < 768,
    isTablet:  w >= 768 && w <= 1024,
    isDesktop: w > 1024,
  };
}

export function useViewport() {
  const [viewport, setViewport] = useState(getState);

  useEffect(() => {
    const update = () => setViewport(getState());

    // iOS Safari sometimes skips resize — use matchMedia too
    const mq768  = window.matchMedia('(max-width: 767px)');
    const mq1024 = window.matchMedia('(max-width: 1024px)');

    window.addEventListener('resize', update);
    mq768.addEventListener('change', update);
    mq1024.addEventListener('change', update);

    return () => {
      window.removeEventListener('resize', update);
      mq768.removeEventListener('change', update);
      mq1024.removeEventListener('change', update);
    };
  }, []);

  return viewport;
}
