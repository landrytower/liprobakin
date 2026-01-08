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

  // Extract clean text from HTML (handles both escaped and unescaped)
  const cleanText = useMemo(() => {
    if (!htmlContent) return '';
    
    // Unescape if needed
    let text = htmlContent.includes('&lt;') ? unescapeHtml(htmlContent) : htmlContent;
    
    // Remove all HTML tags completely
    text = text.replace(/<[^>]*>/g, '');
    
    // Clean up any remaining entities
    text = unescapeHtml(text);
    
    return text.trim();
  }, [htmlContent]);

  // Extract mentions from original HTML
  const mentions = useMemo(() => {
    if (!htmlContent) return [];
    
    // Handle both escaped and unescaped HTML
    let text = htmlContent.includes('&lt;') ? unescapeHtml(htmlContent) : htmlContent;
    
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

    let content: (string | ReactNode)[] = [cleanText];
    
    // Replace each mention with a clickable span
    mentions.forEach((mention) => {
      const newContent: (string | ReactNode)[] = [];
      
      content.forEach((part) => {
        if (typeof part === 'string') {
          const parts = part.split(mention.label);
          
          parts.forEach((p, idx) => {
            newContent.push(p);
            if (idx < parts.length - 1) {
              newContent.push(
                <span
                  key={`mention-${mention.id}-${idx}`}
                  data-player-id={mention.id}
                  className="text-blue-400 font-semibold cursor-pointer hover:text-blue-300 hover:underline transition-colors"
                >
                  {mention.label}
                </span>
              );
            }
          });
        } else {
          newContent.push(part);
        }
      });
      
      content = newContent;
    });
    
    return content;
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
