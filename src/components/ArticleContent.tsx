"use client";

import { useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseDB } from '@/lib/firebase/firestore';

interface ArticleContentProps {
  htmlContent: string;
  className?: string;
}

// Function to unescape HTML entities
const unescapeHtml = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value.replace(/\u00A0/g, " ");
};

const isTrustedNewsMediaUrl = (url?: string | null) => {
  if (!url) return false;
  const normalized = url.trim();
  if (!normalized) return false;
  return normalized.includes('firebasestorage.googleapis.com') || normalized.includes('storage.googleapis.com');
};

export default function ArticleContent({ htmlContent, className = '' }: ArticleContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const sanitizedHtml = useMemo(() => {
    if (!htmlContent) return '';

    const source = htmlContent.includes('&lt;') ? unescapeHtml(htmlContent) : htmlContent;
    const parser = new DOMParser();
    const parsed = parser.parseFromString(source, 'text/html');

    const blockedSelectors = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta'];
    blockedSelectors.forEach((selector) => {
      parsed.body.querySelectorAll(selector).forEach((node) => node.remove());
    });

    parsed.body.querySelectorAll('*').forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        const attrName = attribute.name.toLowerCase();
        const attrValue = attribute.value || '';

        if (attrName.startsWith('on')) {
          element.removeAttribute(attribute.name);
          return;
        }

        if ((attrName === 'href' || attrName === 'src') && /^\s*javascript:/i.test(attrValue)) {
          element.removeAttribute(attribute.name);
          return;
        }

        if (attrName === 'style') {
          element.removeAttribute(attribute.name);
        }
      });

      const tagName = element.tagName.toLowerCase();

      if (tagName === 'a') {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'noopener noreferrer');
        element.classList.add('text-orange-400', 'underline', 'decoration-orange-500/60', 'hover:text-orange-300', 'break-words', 'transition-colors');
      }

      if (tagName === 'img') {
        const src = element.getAttribute('src') || '';
        if (!isTrustedNewsMediaUrl(src)) {
          element.remove();
          return;
        }

        element.setAttribute('loading', 'lazy');
        element.classList.add('rounded-lg', 'my-3', 'max-w-full', 'h-auto');
      }

      if (tagName === 'video') {
        const src = element.getAttribute('src') || '';
        if (!isTrustedNewsMediaUrl(src)) {
          element.remove();
          return;
        }

        element.setAttribute('controls', 'true');
        element.setAttribute('playsinline', 'true');
        element.classList.add('rounded-lg', 'my-3', 'max-w-full');
      }

      if (element.getAttribute('data-type') === 'mention') {
        const mentionId = element.getAttribute('data-id') || '';
        if (mentionId) {
          element.setAttribute('data-player-id', mentionId);
          element.classList.add('text-blue-400', 'font-semibold', 'cursor-pointer', 'hover:text-blue-300', 'hover:underline', 'transition-colors');
        }
      }
    });

    return parsed.body.innerHTML;
  }, [htmlContent]);

  useEffect(() => {
    if (!contentRef.current) return;

    const setupMentions = async () => {
      const mentionElements = contentRef.current?.querySelectorAll('[data-player-id]') || [];
      
      for (const mention of Array.from(mentionElements)) {
        const playerId = mention.getAttribute('data-player-id');
        if (!playerId) continue;

        const clickHandler = async (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          
          try {
            const teamsSnapshot = await getDocs(collection(firebaseDB, 'teams'));
            
            for (const teamDoc of teamsSnapshot.docs) {
              const playerDoc = await getDoc(doc(firebaseDB, `teams/${teamDoc.id}/roster/${playerId}`));
              
              if (playerDoc.exists()) {
                const playerData = playerDoc.data();
                const teamData = teamDoc.data();
                const teamName = teamData.name;
                const playerNumber = playerData.number;
                
                if (teamName && playerNumber != null) {
                  router.push(`/player/${encodeURIComponent(teamName)}/${playerNumber}`);
                  return;
                }
              }
            }
          } catch (error) {
            console.error('Error navigating to player:', error);
          }
        };
        
        mention.addEventListener('click', clickHandler as EventListener);
      }
    };

    setupMentions();
  }, [htmlContent, router]);

  return (
    <div 
      ref={contentRef}
      className={`${className} break-words`}
    >
      {sanitizedHtml ? <div className="article-rich-content prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} /> : null}

      <style jsx global>{`
        .article-rich-content {
          color: rgb(226 232 240);
          font-size: 1.125rem;
          line-height: 1.7;
        }

        .article-rich-content p {
          margin: 0 0 1rem;
        }

        .article-rich-content h2 {
          font-size: 1.5em;
          line-height: 1.2;
          font-weight: 700;
          margin-top: 1em;
          margin-bottom: 0.5em;
          color: rgb(248 250 252);
        }

        .article-rich-content h3 {
          font-size: 1.25em;
          line-height: 1.25;
          font-weight: 700;
          margin-top: 0.8em;
          margin-bottom: 0.4em;
          color: rgb(248 250 252);
        }

        .article-rich-content ul,
        .article-rich-content ol {
          padding-left: 1.5em;
          margin: 0.5em 0 1rem;
        }

        .article-rich-content strong {
          color: rgb(248 250 252);
          font-weight: 700;
        }

        .article-rich-content li {
          margin: 0.25em 0;
        }

        .article-rich-content img.rt-image {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 10px;
          margin-top: 12px;
          margin-bottom: 12px;
          object-fit: cover;
        }

        .article-rich-content img.rt-image-left {
          margin-left: 0;
          margin-right: auto;
        }

        .article-rich-content img.rt-image-center {
          margin-left: auto;
          margin-right: auto;
        }

        .article-rich-content img.rt-image-right {
          margin-left: auto;
          margin-right: 0;
        }

        .article-rich-content img.rt-image-bottom {
          margin-left: auto;
          margin-right: auto;
          margin-top: 24px;
          clear: both;
        }

        .article-rich-content img.rt-image-wrap.rt-image-left {
          float: left;
          margin-right: 16px;
          margin-bottom: 8px;
          margin-top: 4px;
        }

        .article-rich-content img.rt-image-wrap.rt-image-right {
          float: right;
          margin-left: 16px;
          margin-bottom: 8px;
          margin-top: 4px;
        }

        .article-rich-content img.rt-image-small {
          width: min(38%, 260px);
        }

        .article-rich-content img.rt-image-medium {
          width: min(56%, 420px);
        }

        .article-rich-content img.rt-image-large {
          width: min(78%, 720px);
        }

        .article-rich-content img.rt-image-full {
          width: 100%;
        }

        .article-rich-content .rt-video {
          display: block;
          max-width: 100%;
          border-radius: 10px;
          margin: 12px auto;
        }

        .article-rich-content .rt-video-left {
          margin-left: 0;
          margin-right: auto;
        }

        .article-rich-content .rt-video-center {
          margin-left: auto;
          margin-right: auto;
        }

        .article-rich-content .rt-video-right {
          margin-left: auto;
          margin-right: 0;
        }

        .article-rich-content .rt-video-bottom {
          margin-top: 24px;
          margin-left: auto;
          margin-right: auto;
          clear: both;
        }

        .article-rich-content .rt-video-small {
          width: min(42%, 320px);
        }

        .article-rich-content .rt-video-medium {
          width: min(68%, 560px);
        }

        .article-rich-content .rt-video-large {
          width: min(86%, 860px);
        }

        .article-rich-content .rt-video-full {
          width: 100%;
        }

        .article-rich-content::after {
          content: "";
          display: block;
          clear: both;
        }

        @media (max-width: 768px) {
          .article-rich-content img.rt-image-small,
          .article-rich-content img.rt-image-medium,
          .article-rich-content img.rt-image-large,
          .article-rich-content .rt-video-small,
          .article-rich-content .rt-video-medium,
          .article-rich-content .rt-video-large {
            width: 100%;
          }

          .article-rich-content img.rt-image-wrap.rt-image-left,
          .article-rich-content img.rt-image-wrap.rt-image-right {
            float: none;
            margin-left: auto;
            margin-right: auto;
          }
        }
      `}</style>
    </div>
  );
}
