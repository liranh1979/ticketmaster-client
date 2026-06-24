import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { formatDateTime, formatDate, formatTime } from '../utils/dateTime';

export const useDateTimeFormatter = () => {
  const { defaultTimezone, defaultTimeFormat } = useSystemSettings();
  const opts = { timezone: defaultTimezone, hour12: defaultTimeFormat === '12h' };

  return {
    formatDateTime: (value: Date | string | number) => formatDateTime(value, opts),
    formatDate: (value: Date | string | number) => formatDate(value, opts),
    formatTime: (value: Date | string | number) => formatTime(value, opts),
  };
};
