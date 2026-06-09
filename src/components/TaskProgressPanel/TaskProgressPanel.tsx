import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './TaskProgressPanel.css';

interface Task {
  id: string;
  name: string;
  total: number;
  current: number;
  percentage: number;
  message: string;
  status: 'running' | 'completed' | 'failed';
}

export const TaskProgressPanel = () => {
  const { t } = useTranslation();
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [minimized, setMinimized] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const connect = () => {
      const es = new EventSource(
        (import.meta.env.VITE_API_URL || '/api/v1') + '/tasks/stream',
        { withCredentials: true }
      );
      esRef.current = es;

      es.addEventListener('task-progress', (e) => {
        const task: Task = JSON.parse(e.data);
        setTasks(prev => {
          const idx = prev.findIndex(t => t.id === task.id);
          if (task.status !== 'running') {
            setTimeout(() => setTasks(p => p.filter(t => t.id !== task.id)), 8000);
          }
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = task;
            return next;
          }
          return [...prev, task];
        });
      });

      es.onerror = () => { es.close(); setTimeout(connect, 3000); };
    };

    connect();
    return () => esRef.current?.close();
  }, []);

  if (tasks.length === 0) return null;

  const runningCount = tasks.filter(t => t.status === 'running').length;

  return (
    <div className={`tp-panel ${minimized ? 'tp-minimized' : ''}`}>
      <div className="tp-header" onClick={() => setMinimized(m => !m)}>
        <div className="tp-header-left">
          <span className="tp-pulse" />
          <span className="tp-title">{t('bg_tasks_title')}</span>
          <span className="tp-count">{runningCount} {t('tasks_running_label')}</span>
        </div>
        <button className="tp-toggle">{minimized ? '▲' : '▼'}</button>
      </div>

      {!minimized && (
        <div className="tp-body">
          {tasks.map(task => (
            <div key={task.id} className={`tp-task tp-task-${task.status}`}>
              <div className="tp-task-header">
                <span className="tp-task-name">{task.name}</span>
                <span className="tp-task-pct">{task.percentage}%</span>
                <span className={`tp-status-badge tp-status-${task.status}`}>
                  {t(`task_status_${task.status}`)}
                </span>
              </div>
              <div className="tp-bar-track">
                <div className={`tp-bar-fill tp-bar-${task.status}`} style={{ width: `${task.percentage}%` }} />
              </div>
              <p className="tp-task-msg">{task.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};