import { useState } from 'react';
import { PlusCircle, MessageSquare } from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import './ActivityLogControl.css';

interface ActivityEntry {
  id: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  timestamp: string;
  content: string;
}

const SAMPLE_ENTRIES: ActivityEntry[] = [
  {
    id: 'sample-1',
    authorName: 'Alex Chen',
    authorInitials: 'AC',
    authorColor: '#3b82f6',
    timestamp: 'Today at 9:12 AM',
    content:
      '<p>Ticket received and triaged. Assigned to the technical support team for initial investigation. Reproducing the issue in the staging environment to confirm scope.</p>',
  },
  {
    id: 'sample-2',
    authorName: 'Maria Santos',
    authorInitials: 'MS',
    authorColor: '#10b981',
    timestamp: 'Today at 11:47 AM',
    content:
      '<p>Root cause identified — misconfigured firewall rule introduced in last week\'s network change window.</p><p><strong>Proposed fix:</strong> Revert rule #1042 and apply the corrected policy. Change window scheduled for <em>2:00 PM today</em>. Users experiencing access issues can use the VPN workaround in the meantime.</p>',
  },
  {
    id: 'sample-3',
    authorName: 'Jordan Park',
    authorInitials: 'JP',
    authorColor: '#f59e0b',
    timestamp: 'Today at 2:18 PM',
    content: '<p>Fix deployed and verified across all three production nodes. Monitoring dashboards are green. ✅ Ready to close pending 30-minute stability window.</p>',
  },
];

interface Props {
  previewMode?: boolean;
  readonly?: boolean;
}

export const ActivityLogControl = ({ previewMode = false, readonly = false }: Props) => {
  const [entries, setEntries] = useState<ActivityEntry[]>(previewMode ? SAMPLE_ENTRIES : []);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const submitEntry = () => {
    const stripped = draft.replace(/<[^>]*>/g, '').trim();
    if (!stripped) return;
    setEntries(prev => [
      {
        id: Date.now().toString(),
        authorName: 'You',
        authorInitials: 'YO',
        authorColor: '#3b82f6',
        timestamp: 'Just now',
        content: draft,
      },
      ...prev,
    ]);
    setDraft('');
    setIsAdding(false);
  };

  return (
    <div className="alc-container">

      {/* Header bar */}
      <div className="alc-header">
        <div className="alc-header-left">
          <MessageSquare size={15} className="alc-header-icon" />
          <span className="alc-title">Activity Log</span>
          {previewMode && <span className="alc-preview-chip">Sample Preview</span>}
          <span className="alc-count-chip">{entries.length}</span>
        </div>
        {!readonly && !previewMode && (
          <button className="alc-add-btn" onClick={() => setIsAdding(true)} disabled={isAdding}>
            <PlusCircle size={13} />
            Add Update
          </button>
        )}
      </div>

      {/* Inline composer */}
      {isAdding && (
        <div className="alc-composer">
          <div className="alc-composer-avatar" style={{ background: '#3b82f6' }}>YO</div>
          <div className="alc-composer-body">
            <RichTextEditor
              content={draft}
              onChange={setDraft}
              placeholder="Write an update, comment, or resolution note..."
            />
            <div className="alc-composer-actions">
              <button className="alc-post-btn" onClick={submitEntry}>Post Update</button>
              <button
                className="alc-cancel-btn"
                onClick={() => { setIsAdding(false); setDraft(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="alc-empty">
          <MessageSquare size={38} className="alc-empty-icon" />
          <p className="alc-empty-title">No activity yet</p>
          <p className="alc-empty-sub">
            Updates, comments, and resolution notes will appear here as the ticket progresses.
          </p>
          {!readonly && !previewMode && (
            <button className="alc-empty-cta" onClick={() => setIsAdding(true)}>
              <PlusCircle size={13} />
              Be the first to add an update
            </button>
          )}
        </div>
      )}

      {/* Timeline */}
      {entries.length > 0 && (
        <div className="alc-timeline">
          {entries.map((entry, idx) => (
            <div key={entry.id} className={`alc-entry ${idx === entries.length - 1 ? 'last' : ''}`}>
              <div className="alc-entry-left">
                <div className="alc-avatar" style={{ background: entry.authorColor }}>
                  {entry.authorInitials}
                </div>
                {idx < entries.length - 1 && <div className="alc-connector" />}
              </div>
              <div className="alc-entry-right">
                <div className="alc-entry-meta">
                  <span className="alc-entry-author">{entry.authorName}</span>
                  <span className="alc-entry-sep">·</span>
                  <span className="alc-entry-time">{entry.timestamp}</span>
                </div>
                <div className="alc-entry-body">
                  <RichTextEditor content={entry.content} editable={false} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
