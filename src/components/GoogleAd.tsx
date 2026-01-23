'use client';

import { useEffect, useRef } from 'react';

interface GoogleAdProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal';
  responsive?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export default function GoogleAd({ 
  slot, 
  format = 'auto', 
  responsive = true,
  style,
  className = ''
}: GoogleAdProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const adLoadedRef = useRef(false);

  useEffect(() => {
    // Only push once per component instance
    if (adLoadedRef.current) return;
    
    try {
      const el = adRef.current as (HTMLElement & { dataset?: { adStatus?: string } }) | null;
      // Check if ad is already filled or has been pushed
      if (el && !el.dataset?.adStatus && el.innerHTML.trim() === '') {
        adLoadedRef.current = true;
        // @ts-expect-error - AdSense script
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, []);

  return (
    <div className={className} style={style}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', ...style }}
        data-ad-client="ca-pub-6159195090622597"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
}
