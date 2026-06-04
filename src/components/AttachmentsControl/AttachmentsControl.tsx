import { useEffect, useRef, useState } from 'react';
import { UploadCloud, Download, Trash2, File, FileText, Film } from 'lucide-react';
import api from '../../api';
import './AttachmentsControl.css';

interface AttachmentEntry {
  id: number;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}

interface Props {
  entityType: string;
  entityId: number;
  readonly?: boolean;
}

export const AttachmentsControl = ({ entityType, entityId, readonly = false }: Props) => {
  const [attachments, setAttachments] = useState<AttachmentEntry[]>([]);
  const [tokens, setTokens] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [entityType, entityId]);

  const load = async () => {
    try {
      const res = await api.get('/attachments', { params: { entityType, entityId } });
      const list: AttachmentEntry[] = res.data;
      setAttachments(list);
      const pairs = await Promise.all(
        list.map(async (a) => {
          const r = await api.get(`/attachments/${a.id}/token`);
          return [a.id, r.data.token] as [number, string];
        })
      );
      setTokens(Object.fromEntries(pairs));
    } catch {
      // entity may not exist yet — silent fail is fine
    }
  };

  const handleFiles = async (files: FileList) => {
    if (!files.length || uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('files', f));
      await api.post('/attachments', formData, {
        params: { entityType, entityId },
      });
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete('/attachments', { data: [id] });
    setAttachments(prev => prev.filter(a => a.id !== id));
    setTokens(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const previewUrl  = (t: string) => `/api/v1/attachments/preview?token=${t}`;
  const streamUrl   = (t: string) => `/api/v1/attachments/stream?token=${t}`;
  const downloadUrl = (t: string) => `/api/v1/attachments/download?token=${t}`;

  const isImage = (m: string) => m.startsWith('image/');
  const isVideo = (m: string) => m.startsWith('video/');
  const isPdf   = (m: string) => m === 'application/pdf';

  const formatSize = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1_048_576).toFixed(1)} MB`;
  };

  return (
    <div className="att-control">
      {!readonly && (
        <div
          className={`att-dropzone${dragOver ? ' drag-over' : ''}${uploading ? ' uploading' : ''}`}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
          />
          <UploadCloud size={36} />
          <span className="att-drop-text">
            {uploading ? 'Uploading…' : 'Click or drag files here to upload'}
          </span>
          <span className="att-drop-hint">Max 5 MB per file · Images, videos, PDFs, documents</span>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="att-grid">
          {attachments.map(a => {
            const token = tokens[a.id];
            return (
              <div key={a.id} className="att-card">
                <div className="att-thumb">
                  {!token ? (
                    <div className="att-thumb-shimmer" />
                  ) : isImage(a.mimeType) ? (
                    <img src={previewUrl(token)} alt={a.originalFilename} />
                  ) : isVideo(a.mimeType) ? (
                    <video src={streamUrl(token)} preload="metadata" />
                  ) : isPdf(a.mimeType) ? (
                    <div className="att-file-icon pdf"><FileText size={40} /></div>
                  ) : (
                    <div className="att-file-icon"><File size={40} /></div>
                  )}
                  {isVideo(a.mimeType) && token && (
                    <div className="att-video-badge"><Film size={12} /></div>
                  )}
                </div>

                <div className="att-card-info">
                  <span className="att-card-name" title={a.originalFilename}>
                    {a.originalFilename}
                  </span>
                  <span className="att-card-size">{formatSize(a.fileSize)}</span>
                </div>

                <div className="att-card-actions">
                  {token && (
                    <a
                      className="att-action-btn"
                      href={downloadUrl(token)}
                      target="_blank"
                      rel="noreferrer"
                      title="Download"
                    >
                      <Download size={13} />
                    </a>
                  )}
                  {!readonly && (
                    <button
                      className="att-action-btn delete"
                      onClick={() => handleDelete(a.id)}
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {attachments.length === 0 && readonly && (
        <div className="att-empty">No attachments</div>
      )}
    </div>
  );
};
