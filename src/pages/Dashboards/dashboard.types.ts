export interface DashboardTimeSeriesPoint {
  bucket: string;
  count: number;
}

export interface DashboardSeries {
  day: DashboardTimeSeriesPoint[];
  week: DashboardTimeSeriesPoint[];
  month: DashboardTimeSeriesPoint[];
  byStatus: Record<string, number>;
}

export interface RecurringProblem {
  description: string;
  confidencePercent: number;
  solution: string | null;
}

export interface DashboardAiReport {
  summary: string;
  recurringProblems: RecurringProblem[];
  cached: boolean;
  generatedAt: string;
}

export interface TicketsDashboardResponse {
  tickets: DashboardSeries;
  actionItems: DashboardSeries;
  aiReport: DashboardAiReport;
}

export type DashboardRange = 'day' | 'week' | 'month';
