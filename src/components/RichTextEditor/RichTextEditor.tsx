import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote, Code2,
  Link as LinkIcon, Link2Off, ImageIcon, Video, Heading1, Heading2, Paperclip,
} from 'lucide-react';
import api from '../../api';
import { Video as VideoNode } from './VideoExtension';
import './RichTextEditor.css';

interface RichTextEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  compact?: boolean;
  placeholder?: string;
  insertTrigger?: { text: string; count: number };
  /** When set, shows an "Insert File" upload button — uploads a real file via the existing
   * attachments endpoint (entityType/entityId), then inserts it inline based on its MIME type
   * (image → <img>, video → the custom Video node, anything else → a download-link chip). The
   * uploaded file also becomes a real ticket Attachment, not just embedded HTML. */
  uploadContext?: { entityType: string; entityId: number };
}

export const RichTextEditor = ({
  content = '',
  onChange,
  editable = true,
  compact = false,
  placeholder = 'Enter text...',
  insertTrigger,
  uploadContext,
}: RichTextEditorProps) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      VideoNode,
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

  const triggerFileUpload = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so selecting the same file again still fires onChange
    if (!file || !uploadContext) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      const res = await api.post('/attachments', formData, {
        params: { entityType: uploadContext.entityType, entityId: uploadContext.entityId },
      });
      const uploaded = res.data?.[0];
      if (!uploaded) return;

      const mimeType: string = uploaded.mimeType || '';
      const inlineUrl = `/api/v1/attachments/${uploaded.id}/inline`;
      if (mimeType.startsWith('image/')) {
        editor.chain().focus().setImage({ src: inlineUrl }).run();
      } else if (mimeType.startsWith('video/')) {
        editor.chain().focus().setVideo({ src: inlineUrl }).run();
      } else {
        // AttachmentController only exposes a plain, no-token GET by id at /{id}/inline (the
        // separate /download endpoint needs a one-time token minted via /{id}/token — not
        // needed here since this link is same-origin, cookie-authenticated, and the whole
        // point is "open the attached file", inline or not).
        editor.chain().focus().insertContent(
          `<a href="${inlineUrl}" target="_blank" rel="noreferrer" class="rte-file-chip">📎 ${uploaded.originalFilename}</a>`
        ).run();
      }
    } catch {
      window.alert(t('ticket_solution_upload_failed', { defaultValue: 'Upload failed. Please try again.' }));
    } finally {
      setUploading(false);
    }
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
            {uploadContext && (
              <>
                <button type="button" onClick={triggerFileUpload} disabled={uploading}
                  title={t('ticket_solution_insert_file_btn', { defaultValue: 'Insert File' })}>
                  <Paperclip size={14} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
              </>
            )}
          </div>
          {uploading && (
            <span className="rte-uploading-note">
              {t('ticket_solution_uploading', { defaultValue: 'Uploading…' })}
            </span>
          )}
        </div>
      )}
      <EditorContent editor={editor} className="rte-content" />
    </div>
  );
};
