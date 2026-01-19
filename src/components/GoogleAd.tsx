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

  useEffect(() => {
    try {
      // Prevent pushing twice on the same <ins> which triggers "already have ads" errors
      const el = adRef.current as (HTMLDivElement & { dataset?: { adStatus?: string } }) | null;
      if (el && !el.dataset?.adStatus) {
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
