"use client";

import { useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseDB } from '@/lib/firebase';

interface ArticleContentProps {
  htmlContent: string;
  className?: string;
}

// Function to unescape HTML entities
const unescapeHtml = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

export default function ArticleContent({ htmlContent, className = '' }: ArticleContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const createLinkNodes = (text: string, keyPrefix: string): ReactNode[] => {
    const nodes: ReactNode[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let linkIndex = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }

      const url = match[0];
      nodes.push(
        <a
          key={`${keyPrefix}-url-${linkIndex}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 underline decoration-orange-500/60 hover:text-orange-300 break-words transition-colors"
        >
          {url}
        </a>
      );

      lastIndex = urlRegex.lastIndex;
      linkIndex += 1;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes;
  };

  // Extract clean text from HTML (handles both escaped and unescaped)
  const cleanText = useMemo(() => {
    if (!htmlContent) return '';
    
    // Unescape if needed
    let text = htmlContent.includes('&lt;') ? unescapeHtml(htmlContent) : htmlContent;
    
    // Preserve paragraph structure: convert block elements to double newlines
    text = text.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n'); // Between paragraphs
    text = text.replace(/<p[^>]*>/gi, ''); // Opening p tags
    text = text.replace(/<\/p>/gi, '\n\n'); // Closing p tags add newlines
    
    // Preserve line breaks
    text = text.replace(/<br\s*\/?>/gi, '\n');
    
    // Preserve heading structure with extra spacing
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<h[1-6][^>]*>/gi, '');
    
    // Preserve div blocks as newlines
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<div[^>]*>/gi, '');
    
    // Preserve list items with bullets
    text = text.replace(/<li[^>]*>/gi, '\n• ');
    text = text.replace(/<\/li>/gi, '');
    text = text.replace(/<\/?[ou]l[^>]*>/gi, '\n');
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]*>/g, '');
    
    // Clean up any remaining entities
    text = unescapeHtml(text);
    
    // Clean up excessive whitespace while preserving intentional line breaks
    text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 newlines in a row
    text = text.replace(/^\s+/, ''); // Trim leading whitespace
    text = text.replace(/\s+$/, ''); // Trim trailing whitespace
    
    return text;
  }, [htmlContent]);

  // Extract mentions from original HTML
  const mentions = useMemo(() => {
    if (!htmlContent) return [];
    
    // Handle both escaped and unescaped HTML
    const text = htmlContent.includes('&lt;') ? unescapeHtml(htmlContent) : htmlContent;
    
    // Match mention spans
    const mentionRegex = /data-id="([^"]*)"[^>]*data-label="([^"]*)"/g;
    const result: Array<{ id: string; label: string }> = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      result.push({
        id: match[1],
        label: match[2],
      });
    }
    
    return result;
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

  // Build content with mentions replaced by clickable spans
  const renderContent = () => {
    if (!cleanText) return null;

    if (mentions.length === 0) {
      return createLinkNodes(cleanText, 'segment-0');
    }

    const mentionByLabel = new Map<string, { id: string; label: string }>();
    mentions.forEach((mention) => {
      if (!mentionByLabel.has(mention.label)) {
        mentionByLabel.set(mention.label, mention);
      }
    });

    const labels = Array.from(mentionByLabel.keys())
      .filter((label) => label.trim().length > 0)
      .sort((a, b) => b.length - a.length);

    if (labels.length === 0) {
      return createLinkNodes(cleanText, 'segment-0');
    }

    const mentionRegex = new RegExp(`(${labels.map(escapeRegex).join('|')})`, 'g');
    const segments = cleanText.split(mentionRegex);
    const rendered: ReactNode[] = [];
    let mentionOccurrence = 0;

    segments.forEach((segment, segmentIndex) => {
      if (!segment) return;

      const mention = mentionByLabel.get(segment);
      if (mention) {
        rendered.push(
          <span
            key={`mention-${mention.id}-${segmentIndex}-${mentionOccurrence}`}
            data-player-id={mention.id}
            className="text-blue-400 font-semibold cursor-pointer hover:text-blue-300 hover:underline transition-colors"
          >
            {mention.label}
          </span>
        );
        mentionOccurrence += 1;
        return;
      }

      rendered.push(...createLinkNodes(segment, `segment-${segmentIndex}`));
    });

    return rendered;
  };

  return (
    <div 
      ref={contentRef}
      className={`${className} text-base md:text-lg leading-relaxed text-slate-200 whitespace-pre-wrap break-words`}
    >
      {renderContent()}
    </div>
  );
}
