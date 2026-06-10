import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote, Code2,
  Link as LinkIcon, Link2Off, ImageIcon, Video, Heading1, Heading2,
} from 'lucide-react';
import './RichTextEditor.css';

interface RichTextEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  compact?: boolean;
  placeholder?: string;
  insertTrigger?: { text: string; count: number };
}

export const RichTextEditor = ({
  content = '',
  onChange,
  editable = true,
  compact = false,
  placeholder = 'Enter text...',
  insertTrigger,
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      Youtube.configure({ controls: true }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
      Underline,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && insertTrigger && insertTrigger.text) {
      editor.chain().focus().insertContent(insertTrigger.text).run();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertTrigger?.count]);

  if (!editor) return null;

  const insertImage = () => {
    const url = window.prompt('Image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const insertYoutube = () => {
    const url = window.prompt('YouTube URL:');
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL:', prev ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  return (
    <div className={`rte-wrapper ${compact ? 'rte-compact' : 'rte-full'} ${!editable ? 'rte-readonly' : ''}`}>
      {editable && (
        <div className="rte-toolbar">
          <div className="rte-group">
            <button type="button" className={editor.isActive('bold') ? 'active' : ''}
              onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
              <Bold size={14} />
            </button>
            <button type="button" className={editor.isActive('italic') ? 'active' : ''}
              onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
              <Italic size={14} />
            </button>
            <button type="button" className={editor.isActive('underline') ? 'active' : ''}
              onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
              <UnderlineIcon size={14} />
            </button>
          </div>

          {!compact && (
            <>
              <div className="rte-separator" />
              <div className="rte-group">
                <button type="button" className={editor.isActive('heading', { level: 1 }) ? 'active' : ''}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
                  <Heading1 size={14} />
                </button>
                <button type="button" className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
                  <Heading2 size={14} />
                </button>
              </div>

              <div className="rte-separator" />
              <div className="rte-group">
                <button type="button" className={editor.isActive('bulletList') ? 'active' : ''}
                  onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
                  <List size={14} />
                </button>
                <button type="button" className={editor.isActive('orderedList') ? 'active' : ''}
                  onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered list">
                  <ListOrdered size={14} />
                </button>
              </div>

              <div className="rte-separator" />
              <div className="rte-group">
                <button type="button" className={editor.isActive('blockquote') ? 'active' : ''}
                  onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
                  <Quote size={14} />
                </button>
                <button type="button" className={editor.isActive('codeBlock') ? 'active' : ''}
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code block">
                  <Code2 size={14} />
                </button>
              </div>
              <div className="rte-separator" />
            </>
          )}

          <div className="rte-group">
            <button type="button" className={editor.isActive('link') ? 'active' : ''}
              onClick={setLink} title="Insert / edit link">
              <LinkIcon size={14} />
            </button>
            {editor.isActive('link') && (
              <button type="button"
                onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">
                <Link2Off size={14} />
              </button>
            )}
          </div>

          <div className="rte-group">
            <button type="button" onClick={insertImage} title="Insert image">
              <ImageIcon size={14} />
            </button>
            {!compact && (
              <button type="button" onClick={insertYoutube} title="Embed YouTube video">
                <Video size={14} />
              </button>
            )}
          </div>
        </div>
      )}
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
};
