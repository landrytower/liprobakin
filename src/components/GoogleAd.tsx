'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

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

  // Show placeholder ad until real AdSense is configured
  const isPlaceholder = slot.match(/^\d+$/);

  if (isPlaceholder) {
    const heights = {
      horizontal: '90px',
      vertical: '600px',
      auto: '250px',
      fluid: '250px',
      rectangle: '250px',
    };

    // Sample ads with basketball/sports theme
    const sampleAds = [
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80',
        title: 'Nike Basketball Shoes',
        description: 'Elevate Your Game',
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1608245449230-4ac19066d2d0?w=800&q=80',
        title: 'Premium Sports Gear',
        description: 'Shop Now',
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=800&q=80',
        title: 'Basketball Training',
        description: 'Join Today',
      },
      {
        type: 'video',
        thumbnail: 'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800&q=80',
        title: 'Watch Game Highlights',
        description: 'Click to Play',
      },
    ];

    const randomAd = sampleAds[Math.floor(Math.random() * sampleAds.length)];

    return (
      <div className={className} style={style}>
        <div
          className="relative overflow-hidden border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg group cursor-pointer hover:border-orange-500/50 transition-all"
          style={{ 
            minHeight: style?.minHeight || heights[format],
            height: style?.minHeight || heights[format],
          }}
        >
          {/* Ad Image/Video */}
          <div className="absolute inset-0">
            <Image
              src={(randomAd.type === 'video' ? randomAd.thumbnail : randomAd.url) || '/logos/Males/febaco-logo.png'}
              alt={randomAd.title}
              fill
              className="object-cover opacity-70 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
              unoptimized
            />
            {randomAd.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-orange-600/90 rounded-full p-4 group-hover:bg-orange-500 transition-all">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* Ad Content */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <div className="text-xs uppercase tracking-wider text-orange-400 mb-1">Advertisement</div>
            <div className="text-sm font-bold mb-1">{randomAd.title}</div>
            <div className="text-xs text-slate-300">{randomAd.description}</div>
          </div>

          {/* Ad Badge */}
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded">
            AD
          </div>
        </div>
      </div>
    );
  }

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
