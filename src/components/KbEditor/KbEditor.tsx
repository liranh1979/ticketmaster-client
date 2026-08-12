import { Editor } from '@tinymce/tinymce-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
}

/**
 * Self-hosted TinyMCE (no Tiny Cloud account/API key) — loaded from a static copy of the
 * `tinymce` npm package's dist assets (see vite-plugin-static-copy in vite.config.ts) via a real
 * <script src>, per TinyMCE's own Vite integration guide. The plain ESM npm-import pattern
 * (Webpack's approach) does not reliably initialize under Vite. Deliberately separate from the
 * Tiptap-based RichTextEditor used for ticket descriptions, per explicit choice for KB authoring.
 */
export const KbEditor = ({ value, onChange, readOnly }: Props) => (
  <Editor
    tinymceScriptSrc={`${import.meta.env.BASE_URL}tinymce/tinymce.min.js`}
    licenseKey="gpl"
    value={value}
    disabled={readOnly}
    onEditorChange={onChange}
    init={{
      height: 420,
      menubar: false,
      plugins: ['lists', 'link', 'code', 'table', 'image'],
      toolbar: 'undo redo | bold italic | bullist numlist | link table image | code',
    }}
  />
);
