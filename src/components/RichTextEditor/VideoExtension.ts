import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Tiptap has no built-in video node (its `extension-youtube` only handles YouTube embeds) —
 * this is a small custom node for real uploaded video files, rendered as a native
 * `<video controls>` pointing at the file's real Attachment URL
 * (`/api/v1/attachments/{id}/inline`), used by RichTextEditor's upload button.
 */
export interface VideoOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

export const Video = Node.create<VideoOptions>({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'video' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { controls: 'true' })];
  },

  addCommands() {
    return {
      setVideo:
        (options: { src: string }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});
