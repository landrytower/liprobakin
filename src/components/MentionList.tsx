"use client";

import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { useEffect, useImperativeHandle, forwardRef, useState, useRef } from 'react';

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

interface MentionListProps {
  items: MentionItem[];
  command: (item: { id: string; label: string; type: 'player' | 'team' }) => void;
}

const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      const label = item.type === 'player' 
        ? `${item.firstName} ${item.lastName}`
        : item.name;
      props.command({ id: item.id, label, type: item.type });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="mention-dropdown">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            key={item.id}
            className={`mention-dropdown-item ${index === selectedIndex ? 'is-selected' : ''}`}
            onClick={() => selectItem(index)}
            type="button"
          >
            {item.type === 'player' ? (
              <>
                {item.firstName} {item.lastName}
                {item.number && ` #${item.number}`}
                <span className="team-name"> - {item.teamName}</span>
              </>
            ) : (
              <>
                <span className="font-semibold">🏀 {item.name}</span>
              </>
            )}
          </button>
        ))
      ) : (
        <div className="mention-dropdown-item empty">Aucun résultat trouvé</div>
      )}
    </div>
  );
});

MentionList.displayName = 'MentionList';

export function createMentionSuggestion() {
  return {
    render: () => {
      let component: ReactRenderer<any>;
      let popup: TippyInstance[];

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            theme: 'dark',
          });
        },

        onUpdate(props: any) {
          component.updateProps(props);

          if (!props.clientRect) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },

        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup[0].hide();
            return true;
          }

          return component.ref?.onKeyDown(props);
        },

        onExit() {
          popup[0].destroy();
          component.destroy();
        },
      };
    },
  };
}
