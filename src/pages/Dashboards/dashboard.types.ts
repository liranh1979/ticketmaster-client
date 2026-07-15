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
  stale: boolean;
  generatedAt: string | null;
}

export interface CsatImprovementPoint {
  point: string;
  evidence: string;
}

export interface CsatAiAnalysis {
  summary: string;
  improvementPoints: CsatImprovementPoint[];
  cached: boolean;
  stale: boolean;
  generatedAt: string | null;
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

export interface SlaFinding {
  observation: string;
  recommendation: string;
}

export interface SlaAiInsight {
  summary: string;
  findings: SlaFinding[];
  cached: boolean;
  stale: boolean;
  generatedAt: string | null;
}

export interface SlaPriorityStat {
  priority: string;
  total: number;
  resolvedCount: number;
  firstResponseBreached: number;
  resolutionBreached: number;
  resolutionBreachRatePercent: number;
}

export interface SlaDashboard {
  priorityStats: SlaPriorityStat[];
  aiInsight: SlaAiInsight;
}

export interface TicketsDashboardResponse {
  tickets: DashboardSeries;
  actionItems: DashboardSeries;
  aiReport: DashboardAiReport;
  csat: CsatDashboard;
  sla: SlaDashboard;
  sectionOrder: string[];
}

export type DashboardRange = 'day' | 'week' | 'month';
