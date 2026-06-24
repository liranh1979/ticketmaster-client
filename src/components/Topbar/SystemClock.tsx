import { useEffect, useState } from 'react';
import { useDateTimeFormatter } from '../../hooks/useDateTimeFormatter';
import './SystemClock.css';

export const SystemClock = () => {
  const { formatDate, formatTime } = useDateTimeFormatter();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sd-clock" title={formatDate(now)}>
      <span className="sd-clock__time">{formatTime(now)}</span>
      <span className="sd-clock__date">{formatDate(now)}</span>
    </div>
  );
};
