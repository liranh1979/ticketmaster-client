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

export interface CsatImprovementPoint {
  point: string;
  evidence: string;
}

export interface CsatAiAnalysis {
  summary: string;
  improvementPoints: CsatImprovementPoint[];
  cached: boolean;
  generatedAt: string;
}

export interface CsatLowScoreTicket {
  ticketId: number;
  title: string;
  agent: string;
  score: number;
  comment: string;
}

export interface CsatDashboard {
  avgScore: number;
  responseRate: number;
  lowScorePercent: number;
  distribution: Record<string, number>;
  lowScoreTickets: CsatLowScoreTicket[];
  aiAnalysis: CsatAiAnalysis;
}

export interface TicketsDashboardResponse {
  tickets: DashboardSeries;
  actionItems: DashboardSeries;
  aiReport: DashboardAiReport;
  csat: CsatDashboard;
}

export type DashboardRange = 'day' | 'week' | 'month';
