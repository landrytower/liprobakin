"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firebaseDB } from '@/lib/firebase';
import { firebaseStorage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createMentionSuggestion } from './MentionList';
import 'tippy.js/dist/tippy.css';

/* ---------- Custom Video Node Extension ---------- */
const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      class: { default: 'rt-video rt-video-center rt-video-medium' },
    };
  },

  parseHTML() {
    return [{ tag: 'video' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, { controls: true, playsinline: true }),
    ];
  },
});

type VideoAlign = 'left' | 'center' | 'right' | 'bottom';
type VideoSize = 'small' | 'medium' | 'large' | 'full';

const getVideoClass = (align: VideoAlign, size: VideoSize) => `rt-video rt-video-${align} rt-video-${size}`;

const parseVideoClass = (raw?: string): { align: VideoAlign; size: VideoSize } => {
  const value = raw || '';
  const align: VideoAlign = value.includes('rt-video-left')
    ? 'left'
    : value.includes('rt-video-right')
      ? 'right'
      : value.includes('rt-video-bottom')
        ? 'bottom'
        : 'center';
  const size: VideoSize = value.includes('rt-video-small')
    ? 'small'
    : value.includes('rt-video-large')
      ? 'large'
      : value.includes('rt-video-full')
        ? 'full'
        : 'medium';
  return { align, size };
};

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  language?: 'fr' | 'en';
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  teamName: string;
  number: number | null;
  type: 'player';
}

interface Team {
  id: string;
  name: string;
  type: 'team';
}

type MentionItem = Player | Team;

type ImageAlign = 'left' | 'center' | 'right' | 'bottom';
type ImageSize = 'small' | 'medium' | 'large' | 'full';

const getImageClass = (align: ImageAlign, size: ImageSize, wrap: boolean) => 
  `rt-image rt-image-${align} rt-image-${size}${wrap ? ' rt-image-wrap' : ''}`;

const parseImageClass = (raw?: string): { align: ImageAlign; size: ImageSize; wrap: boolean } => {
  const value = raw || '';
  const align: ImageAlign = value.includes('rt-image-left')
    ? 'left'
    : value.includes('rt-image-right')
      ? 'right'
      : value.includes('rt-image-bottom')
        ? 'bottom'
        : 'center';
  const size: ImageSize = value.includes('rt-image-small')
    ? 'small'
    : value.includes('rt-image-large')
      ? 'large'
      : value.includes('rt-image-full')
        ? 'full'
        : 'medium';
  const wrap = value.includes('rt-image-wrap');
  return { align, size, wrap };
};

export default function RichTextEditor({ content, onChange, placeholder = "Écrivez votre article ici...", language = 'fr' }: RichTextEditorProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [allMentionItems, setAllMentionItems] = useState<MentionItem[]>([]);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [selectedImageAttrs, setSelectedImageAttrs] = useState<{ align: ImageAlign; size: ImageSize; wrap: boolean } | null>(null);
  const [selectedVideoAttrs, setSelectedVideoAttrs] = useState<{ align: VideoAlign; size: VideoSize } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Fetch all players and teams for mention suggestions
    const fetchData = async () => {
      try {
        console.log('🏀 Fetching teams and players...');
        const teamsSnapshot = await getDocs(collection(firebaseDB, 'teams'));
        console.log('🏀 Found teams:', teamsSnapshot.size);
        const allPlayers: Player[] = [];
        const allTeams: Team[] = [];

        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          console.log('🏀 Processing team:', teamDoc.id, 'Name:', teamData.name);
          
          // Add team to teams list
          allTeams.push({
            id: teamDoc.id,
            name: teamData.name || '',
            type: 'team',
          });

          // Fetch roster
          const rosterSnapshot = await getDocs(collection(firebaseDB, `teams/${teamDoc.id}/roster`));
          console.log('🏀 Roster size for', teamData.name, ':', rosterSnapshot.size);
          
          rosterSnapshot.forEach((playerDoc) => {
            const playerData = playerDoc.data();
            console.log('🏀 Player:', playerData.firstName, playerData.lastName, '#', playerData.number);
            allPlayers.push({
              id: playerDoc.id,
              firstName: playerData.firstName || '',
              lastName: playerData.lastName || '',
              teamName: teamData.name || '',
              number: playerData.number || null,
              type: 'player',
            });
          });
        }

        console.log('🏀 Total players loaded:', allPlayers.length);
        console.log('🏀 Total teams loaded:', allTeams.length);
        setPlayers(allPlayers);
        setAllMentionItems([...allPlayers, ...allTeams]);
      } catch (error) {
        console.error('❌ Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            class: {
              default: getImageClass('left', 'medium', true),
              parseHTML: element => element.getAttribute('class'),
              renderHTML: attributes => ({ class: attributes.class }),
            },
          };
        },
      }),
      Video,
      Mention.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            type: {
              default: 'player',
              parseHTML: element => element.getAttribute('data-mention-type'),
              renderHTML: attributes => {
                return {
                  'data-mention-type': attributes.type,
                };
              },
            },
          };
        },
      }).configure({
        HTMLAttributes: {
          'data-type': 'mention',
          class: 'mention-highlight',
        },
        renderLabel({ node }) {
          return node.attrs.label;
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            console.log('🔍 Searching with query:', query, 'Items available:', allMentionItems.length);
            if (query.length === 0) {
              const result = allMentionItems.slice(0, 8);
              console.log('🔍 Empty query, returning first 8:', result);
              return result;
            }
            const result = allMentionItems
              .filter(item => {
                if (item.type === 'player') {
                  const fullName = `${item.firstName} ${item.lastName}`.toLowerCase();
                  return fullName.includes(query.toLowerCase());
                } else {
                  return item.name.toLowerCase().includes(query.toLowerCase());
                }
              })
              .slice(0, 15);
            console.log('🔍 Filtered result:', result);
            return result;
          },
          ...createMentionSuggestion(),
        },
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      console.log('📝 Editor content saved:', html.substring(0, 100));
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[400px] focus:outline-none px-4 py-3',
        'data-placeholder': placeholder,
      },
    },
  }, [players]);

  useEffect(() => {
    if (!editor) return;

    const updateSelectionState = () => {
      // Check image selection
      if (!editor.isActive('image')) {
        setSelectedImageAttrs(null);
      } else {
        const attrs = editor.getAttributes('image');
        setSelectedImageAttrs(parseImageClass(attrs.class as string | undefined));
      }
      // Check video selection
      if (!editor.isActive('video')) {
        setSelectedVideoAttrs(null);
      } else {
        const attrs = editor.getAttributes('video');
        setSelectedVideoAttrs(parseVideoClass(attrs.class as string | undefined));
      }
    };

    editor.on('selectionUpdate', updateSelectionState);
    editor.on('update', updateSelectionState);
    updateSelectionState();

    return () => {
      editor.off('selectionUpdate', updateSelectionState);
      editor.off('update', updateSelectionState);
    };
  }, [editor]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const updateSelectedImage = (updates: Partial<{ align: ImageAlign; size: ImageSize; wrap: boolean }>) => {
    if (!selectedImageAttrs) return;
    const nextAlign = updates.align ?? selectedImageAttrs.align;
    const nextSize = updates.size ?? selectedImageAttrs.size;
    const nextWrap = updates.wrap ?? selectedImageAttrs.wrap;

    // If moving to bottom, relocate node to end of document
    if (updates.align === 'bottom') {
      const attrs = editor.getAttributes('image');
      const newClass = getImageClass('bottom', nextSize, false);
      // Delete current image and insert at document end
      editor.chain().focus().deleteSelection().run();
      editor
        .chain()
        .focus('end')
        .insertContent({
          type: 'image',
          attrs: { ...attrs, class: newClass },
        })
        .run();
      return;
    }

    editor.chain().focus().updateAttributes('image', {
      class: getImageClass(nextAlign, nextSize, nextWrap),
    }).run();
  };

  const removeSelectedImage = () => {
    editor.chain().focus().deleteSelection().run();
  };

  const handlePickImage = () => {
    console.log('📷 handlePickImage called, ref exists:', !!fileInputRef.current);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('❌ fileInputRef.current is null');
    }
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    console.log('📷 handleImageChange triggered');
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) {
      console.log('📷 No file selected');
      return;
    }
    console.log('📷 File selected:', file.name, 'size:', file.size);

    setIsImageUploading(true);
    try {
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
      const mediaPath = `news-images/inline-${Date.now()}-${safeName}`;
      console.log('📷 Uploading to:', mediaPath);
      const mediaRef = storageRef(firebaseStorage, mediaPath);
      const uploadResult = await uploadBytes(mediaRef, file);
      console.log('📷 Upload complete:', uploadResult.metadata.fullPath);
      const imageUrl = await getDownloadURL(mediaRef);
      console.log('📷 Download URL:', imageUrl);

      const insertResult = editor
        .chain()
        .focus()
        .insertContent({
          type: 'image',
          attrs: {
            src: imageUrl,
            alt: file.name,
            title: file.name,
            class: getImageClass('left', 'medium', true),
          },
        })
        .run();
      console.log('📷 Insert result:', insertResult);
      editor.chain().focus().insertContent('<p></p>').run();
    } catch (error) {
      console.error('❌ Error uploading inline image:', error);
      alert(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImageUploading(false);
    }
  };

  const updateSelectedVideo = (updates: Partial<{ align: VideoAlign; size: VideoSize }>) => {
    if (!selectedVideoAttrs) return;
    const nextAlign = updates.align ?? selectedVideoAttrs.align;
    const nextSize = updates.size ?? selectedVideoAttrs.size;

    // If moving to bottom, relocate node to end of document
    if (updates.align === 'bottom') {
      const attrs = editor.getAttributes('video');
      const newClass = getVideoClass('bottom', nextSize);
      // Delete current video and insert at document end
      editor.chain().focus().deleteSelection().run();
      editor
        .chain()
        .focus('end')
        .insertContent({
          type: 'video',
          attrs: { ...attrs, class: newClass },
        })
        .run();
      return;
    }

    editor.chain().focus().updateAttributes('video', {
      class: getVideoClass(nextAlign, nextSize),
    }).run();
  };

  const removeSelectedVideo = () => {
    editor.chain().focus().deleteSelection().run();
  };

  const handlePickVideo = () => {
    console.log('🎬 handlePickVideo called, ref exists:', !!videoInputRef.current);
    if (videoInputRef.current) {
      videoInputRef.current.click();
    } else {
      console.error('❌ videoInputRef.current is null');
    }
  };

  const handleVideoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    console.log('🎬 handleVideoChange triggered');
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) {
      console.log('🎬 No file selected');
      return;
    }
    console.log('🎬 File selected:', file.name, 'size:', file.size);

    setIsVideoUploading(true);
    try {
      const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
      const mediaPath = `news-videos/inline-${Date.now()}-${safeName}`;
      console.log('🎬 Uploading to:', mediaPath);
      const mediaRef = storageRef(firebaseStorage, mediaPath);
      const uploadResult = await uploadBytes(mediaRef, file);
      console.log('🎬 Upload complete:', uploadResult.metadata.fullPath);
      const videoUrl = await getDownloadURL(mediaRef);
      console.log('🎬 Download URL:', videoUrl);

      const insertResult = editor
        .chain()
        .focus()
        .insertContent({
          type: 'video',
          attrs: {
            src: videoUrl,
            class: getVideoClass('center', 'medium'),
          },
        })
        .run();
      console.log('🎬 Insert result:', insertResult);
      editor.chain().focus().insertContent('<p></p>').run();
    } catch (error) {
      console.error('❌ Error uploading inline video:', error);
      alert(`Video upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsVideoUploading(false);
    }
  };

  const isFrench = language === 'fr';

  return (
    <div className="rich-text-editor">
      {/* Hidden file inputs - placed at root for stable refs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        title={isFrench ? 'Choisir une image' : 'Choose an image'}
        className="hidden"
        onChange={handleImageChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        title={isFrench ? 'Choisir une vidéo' : 'Choose a video'}
        className="hidden"
        onChange={handleVideoChange}
      />
      {/* Toolbar */}
      <div className="toolbar flex flex-wrap items-center gap-1 rounded-t-lg border border-white/10 bg-slate-900/60 p-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
          title="Gras"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
          title="Italique"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
          title="Barré"
        >
          <s>S</s>
        </button>

        <div className="mx-2 h-6 w-px bg-white/10"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
          title="Titre 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
          title="Titre 3"
        >
          H3
        </button>

        <div className="mx-2 h-6 w-px bg-white/10"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
          title="Liste à puces"
        >
          • Liste
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          title="Liste numérotée"
        >
          1. Liste
        </button>

        <div className="mx-2 h-6 w-px bg-white/10"></div>

        {/* Color Picker */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-400">Couleur:</span>
          <input
            type="color"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            value={editor.getAttributes('textStyle').color || '#ffffff'}
            className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-slate-900"
            title="Couleur du texte"
          />
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetColor().run()}
            className="toolbar-btn"
            title="Réinitialiser la couleur"
          >
            ✕
          </button>
        </div>

        <div className="mx-2 h-6 w-px bg-white/10"></div>

        <div className="text-xs text-slate-400">
          💡 Tapez <strong>@</strong> pour mentionner un joueur
        </div>

        <div className="mx-2 h-6 w-px bg-white/10"></div>

        <button
          type="button"
          onClick={handlePickImage}
          disabled={isImageUploading}
          className={`toolbar-btn ${isImageUploading ? 'opacity-60 cursor-wait' : ''}`}
          title={isFrench ? 'Ajouter une photo' : 'Add photo'}
        >
          {isImageUploading ? (isFrench ? '...' : '...') : (isFrench ? '📷 Photo' : '📷 Photo')}
        </button>
        <button
          type="button"
          onClick={handlePickVideo}
          disabled={isVideoUploading}
          className={`toolbar-btn ${isVideoUploading ? 'opacity-60 cursor-wait' : ''}`}
          title={isFrench ? 'Ajouter une vidéo' : 'Add video'}
        >
          {isVideoUploading ? (isFrench ? '...' : '...') : (isFrench ? '🎬 Vidéo' : '🎬 Video')}
        </button>
      </div>

      {selectedImageAttrs && (
        <div className="image-controls flex flex-wrap items-center gap-2 border-x border-white/10 bg-slate-900/70 px-3 py-2">
          <span className="text-xs text-slate-400">{isFrench ? 'Image sélectionnée :' : 'Selected image:'}</span>
          <button type="button" className={`toolbar-btn ${selectedImageAttrs.align === 'left' ? 'active' : ''}`} onClick={() => updateSelectedImage({ align: 'left' })}>
            {isFrench ? 'Gauche' : 'Left'}
          </button>
          <button type="button" className={`toolbar-btn ${selectedImageAttrs.align === 'center' ? 'active' : ''}`} onClick={() => updateSelectedImage({ align: 'center' })}>
            {isFrench ? 'Centre' : 'Center'}
          </button>
          <button type="button" className={`toolbar-btn ${selectedImageAttrs.align === 'right' ? 'active' : ''}`} onClick={() => updateSelectedImage({ align: 'right' })}>
            {isFrench ? 'Droite' : 'Right'}
          </button>
          <button type="button" className={`toolbar-btn ${selectedImageAttrs.align === 'bottom' ? 'active' : ''}`} onClick={() => updateSelectedImage({ align: 'bottom', wrap: false })}>
            {isFrench ? 'Bas' : 'Bottom'}
          </button>
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button type="button" className={`toolbar-btn ${selectedImageAttrs.size === 'small' ? 'active' : ''}`} onClick={() => updateSelectedImage({ size: 'small' })}>
            S
          </button>
          <button type="button" className={`toolbar-btn ${selectedImageAttrs.size === 'medium' ? 'active' : ''}`} onClick={() => updateSelectedImage({ size: 'medium' })}>
            M
          </button>
          <button type="button" className={`toolbar-btn ${selectedImageAttrs.size === 'large' ? 'active' : ''}`} onClick={() => updateSelectedImage({ size: 'large' })}>
            L
          </button>
          <button type="button" className={`toolbar-btn ${selectedImageAttrs.size === 'full' ? 'active' : ''}`} onClick={() => updateSelectedImage({ size: 'full' })}>
            {isFrench ? 'Plein' : 'Full'}
          </button>
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button 
            type="button" 
            className={`toolbar-btn ${selectedImageAttrs.wrap ? 'active' : ''}`} 
            onClick={() => updateSelectedImage({ wrap: !selectedImageAttrs.wrap })}
            title={isFrench ? 'Texte autour de l\'image' : 'Wrap text around image'}
          >
            {isFrench ? '↩ Enrouler' : '↩ Wrap'}
          </button>
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button type="button" className="toolbar-btn" onClick={removeSelectedImage}>
            {isFrench ? 'Supprimer' : 'Remove'}
          </button>
        </div>
      )}

      {selectedVideoAttrs && (
        <div className="video-controls flex flex-wrap items-center gap-2 border-x border-white/10 bg-slate-900/70 px-3 py-2">
          <span className="text-xs text-slate-400">{isFrench ? 'Vidéo sélectionnée :' : 'Selected video:'}</span>
          <button type="button" className={`toolbar-btn ${selectedVideoAttrs.align === 'left' ? 'active' : ''}`} onClick={() => updateSelectedVideo({ align: 'left' })}>
            {isFrench ? 'Gauche' : 'Left'}
          </button>
          <button type="button" className={`toolbar-btn ${selectedVideoAttrs.align === 'center' ? 'active' : ''}`} onClick={() => updateSelectedVideo({ align: 'center' })}>
            {isFrench ? 'Centre' : 'Center'}
          </button>
          <button type="button" className={`toolbar-btn ${selectedVideoAttrs.align === 'right' ? 'active' : ''}`} onClick={() => updateSelectedVideo({ align: 'right' })}>
            {isFrench ? 'Droite' : 'Right'}
          </button>
          <button type="button" className={`toolbar-btn ${selectedVideoAttrs.align === 'bottom' ? 'active' : ''}`} onClick={() => updateSelectedVideo({ align: 'bottom' })}>
            {isFrench ? 'Bas' : 'Bottom'}
          </button>
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button type="button" className={`toolbar-btn ${selectedVideoAttrs.size === 'small' ? 'active' : ''}`} onClick={() => updateSelectedVideo({ size: 'small' })}>
            S
          </button>
          <button type="button" className={`toolbar-btn ${selectedVideoAttrs.size === 'medium' ? 'active' : ''}`} onClick={() => updateSelectedVideo({ size: 'medium' })}>
            M
          </button>
          <button type="button" className={`toolbar-btn ${selectedVideoAttrs.size === 'large' ? 'active' : ''}`} onClick={() => updateSelectedVideo({ size: 'large' })}>
            L
          </button>
          <button type="button" className={`toolbar-btn ${selectedVideoAttrs.size === 'full' ? 'active' : ''}`} onClick={() => updateSelectedVideo({ size: 'full' })}>
            {isFrench ? 'Plein' : 'Full'}
          </button>
          <div className="mx-1 h-5 w-px bg-white/10" />
          <button type="button" className="toolbar-btn" onClick={removeSelectedVideo}>
            {isFrench ? 'Supprimer' : 'Remove'}
          </button>
        </div>
      )}

      {/* Editor Content */}
      <div className="editor-content rounded-b-lg border border-t-0 border-white/10 bg-slate-900/60">
        <EditorContent editor={editor} />
      </div>

      <style jsx global>{`
        .rich-text-editor .ProseMirror {
          min-height: 400px;
          max-height: 600px;
          overflow-y: auto;
        }

        .rich-text-editor .ProseMirror:focus {
          outline: none;
        }

        .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgb(148 163 184 / 0.5);
          pointer-events: none;
          height: 0;
        }

        .toolbar-btn {
          padding: 6px 12px;
          border-radius: 6px;
          background: transparent;
          color: #94a3b8;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
          border: 1px solid transparent;
        }

        .toolbar-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }

        .toolbar-btn.active {
          background: rgba(99, 102, 241, 0.2);
          color: #818cf8;
          border-color: rgba(99, 102, 241, 0.3);
        }

        .mention {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mention:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .mention-popup {
          position: absolute;
          z-index: 9999;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          padding: 4px;
          min-width: 300px;
          max-height: 300px;
          overflow-y: auto;
        }

        .mention-item {
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          color: #cbd5e1;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .mention-item:hover,
        .mention-item.selected {
          background: rgba(99, 102, 241, 0.2);
          color: white;
        }

        .mention-item.empty {
          color: #64748b;
          cursor: default;
        }

        .mention-item.empty:hover {
          background: transparent;
        }

        .rich-text-editor .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }

        .rich-text-editor .ProseMirror h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 0.8em;
          margin-bottom: 0.4em;
        }

        .rich-text-editor .ProseMirror ul,
        .rich-text-editor .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }

        .rich-text-editor .ProseMirror li {
          margin: 0.25em 0;
        }

        /* Tiptap Mention Suggestions Dropdown */
        .items {
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          padding: 4px;
          max-height: 300px;
          overflow-y: auto;
          position: relative;
        }

        .item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 8px 12px;
          color: #cbd5e1;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .item.is-selected {
          background: rgba(99, 102, 241, 0.2);
          color: white;
        }

        .item:hover {
          background: rgba(99, 102, 241, 0.15);
          color: white;
        }

        /* Mention dropdown styles */
        .mention-dropdown {
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          max-height: 320px;
          overflow-y: auto;
          padding: 4px;
          min-width: 250px;
        }

        .mention-dropdown-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 10px 12px;
          color: #cbd5e1;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .mention-dropdown-item.is-selected {
          background: rgba(99, 102, 241, 0.3);
          color: white;
        }

        .mention-dropdown-item:hover {
          background: rgba(99, 102, 241, 0.2);
          color: white;
        }

        .mention-dropdown-item .team-name {
          color: #9ca3af;
          font-size: 12px;
        }

        .mention-dropdown-item.empty {
          color: #9ca3af;
          cursor: default;
        }

        .mention-dropdown-item.empty:hover {
          background: transparent;
        }

        .mention-highlight {
          color: #6366f1;
          background: rgba(99, 102, 241, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mention-highlight:hover {
          background: rgba(99, 102, 241, 0.2);
          color: #818cf8;
        }

        .rich-text-editor .ProseMirror img.rt-image {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 10px;
          margin-top: 12px;
          margin-bottom: 12px;
          object-fit: cover;
        }

        .rich-text-editor .ProseMirror img.rt-image-left {
          margin-left: 0;
          margin-right: auto;
        }

        .rich-text-editor .ProseMirror img.rt-image-center {
          margin-left: auto;
          margin-right: auto;
        }

        .rich-text-editor .ProseMirror img.rt-image-right {
          margin-left: auto;
          margin-right: 0;
        }

        .rich-text-editor .ProseMirror img.rt-image-bottom {
          margin-left: auto;
          margin-right: auto;
          margin-top: 24px;
          clear: both;
        }

        /* Text wrap mode - floats the image so text flows around */
        .rich-text-editor .ProseMirror img.rt-image-wrap.rt-image-left {
          float: left;
          margin-right: 16px;
          margin-bottom: 8px;
          margin-top: 4px;
        }

        .rich-text-editor .ProseMirror img.rt-image-wrap.rt-image-right {
          float: right;
          margin-left: 16px;
          margin-bottom: 8px;
          margin-top: 4px;
        }

        .rich-text-editor .ProseMirror img.rt-image-small {
          width: min(38%, 260px);
        }

        .rich-text-editor .ProseMirror img.rt-image-medium {
          width: min(56%, 420px);
        }

        .rich-text-editor .ProseMirror img.rt-image-large {
          width: min(78%, 720px);
        }

        .rich-text-editor .ProseMirror img.rt-image-full {
          width: 100%;
        }

        .rich-text-editor .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid rgba(251, 146, 60, 0.85);
          outline-offset: 2px;
        }

        @media (max-width: 768px) {
          .rich-text-editor .ProseMirror img.rt-image-small,
          .rich-text-editor .ProseMirror img.rt-image-medium,
          .rich-text-editor .ProseMirror img.rt-image-large {
            width: 100%;
          }
        }

        /* ---------- Video Styles ---------- */
        .rich-text-editor .ProseMirror video.rt-video {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 10px;
          margin-top: 12px;
          margin-bottom: 12px;
          background: #000;
        }

        .rich-text-editor .ProseMirror video.rt-video-left {
          margin-left: 0;
          margin-right: auto;
        }

        .rich-text-editor .ProseMirror video.rt-video-center {
          margin-left: auto;
          margin-right: auto;
        }

        .rich-text-editor .ProseMirror video.rt-video-right {
          margin-left: auto;
          margin-right: 0;
        }

        .rich-text-editor .ProseMirror video.rt-video-bottom {
          margin-left: auto;
          margin-right: auto;
          margin-top: 24px;
          clear: both;
        }

        .rich-text-editor .ProseMirror video.rt-video-small {
          width: min(38%, 260px);
        }

        .rich-text-editor .ProseMirror video.rt-video-medium {
          width: min(56%, 420px);
        }

        .rich-text-editor .ProseMirror video.rt-video-large {
          width: min(78%, 720px);
        }

        .rich-text-editor .ProseMirror video.rt-video-full {
          width: 100%;
        }

        .rich-text-editor .ProseMirror video.ProseMirror-selectednode {
          outline: 2px solid rgba(251, 146, 60, 0.85);
          outline-offset: 2px;
        }

        @media (max-width: 768px) {
          .rich-text-editor .ProseMirror video.rt-video-small,
          .rich-text-editor .ProseMirror video.rt-video-medium,
          .rich-text-editor .ProseMirror video.rt-video-large {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
