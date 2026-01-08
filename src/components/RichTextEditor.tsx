"use client";

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Mention from '@tiptap/extension-mention';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firebaseDB } from '@/lib/firebase';
import { createMentionSuggestion } from './MentionList';
import 'tippy.js/dist/tippy.css';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  teamName: string;
  number: number | null;
}

export default function RichTextEditor({ content, onChange, placeholder = "Écrivez votre article ici..." }: RichTextEditorProps) {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    // Fetch all players for mention suggestions
    const fetchPlayers = async () => {
      try {
        console.log('🏀 Fetching teams...');
        const teamsSnapshot = await getDocs(collection(firebaseDB, 'teams'));
        console.log('🏀 Found teams:', teamsSnapshot.size);
        const allPlayers: Player[] = [];

        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          console.log('🏀 Processing team:', teamDoc.id, 'Name:', teamData.name);
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
            });
          });
        }

        console.log('🏀 Total players loaded:', allPlayers.length);
        console.log('🏀 Players:', allPlayers);
        setPlayers(allPlayers);
      } catch (error) {
        console.error('❌ Error fetching players:', error);
      }
    };

    fetchPlayers();
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Mention.configure({
        HTMLAttributes: {
          'data-type': 'mention',
          class: 'mention-highlight',
        },
        renderLabel({ node }) {
          return node.attrs.label;
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            console.log('🔍 Searching with query:', query, 'Players available:', players.length);
            if (query.length === 0) {
              const result = players.slice(0, 5);
              console.log('🔍 Empty query, returning first 5:', result);
              return result;
            }
            const result = players
              .filter(player => {
                const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
                return fullName.includes(query.toLowerCase());
              })
              .slice(0, 10);
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
      },
    },
  }, [players]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="rich-text-editor">
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
      </div>

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
      `}</style>
    </div>
  );
}
