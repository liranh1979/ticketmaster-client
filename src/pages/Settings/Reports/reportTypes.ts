export interface ReportField {
  fieldKey: string;
  label: string;
  fieldType: string;
  custom: boolean;
}

export interface ConditionLeaf {
  field: string;
  fieldType: string;
  operator: string;
  value: any;
  isCustom: boolean;
}

export interface ConditionGroup {
  combinator: 'AND' | 'OR';
  conditions: (ConditionLeaf | ConditionGroup)[];
}

export interface ReportDefinition {
  id: number;
  name: string;
  description?: string;
  selectedFields: string[];
  conditions: ConditionGroup;
  exportFormats: string[];
  isActive: boolean;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  scheduleEnabled: boolean;
  cronExpression?: string;
  frequencyType?: string;
  recipientUserIds?: number[];
  recipientGroupId?: number;
  recipientGroupName?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  lastRunStatus?: string;
}

export interface ReportRun {
  id: number;
  reportDefinitionId: number;
  triggeredBy: string;
  rowCount?: number;
  status: string;
  aiSummary?: string;
  aiTips?: { description: string; confidencePercent: number }[];
  csvPath?: string;
  pdfPath?: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface PreviewResult {
  selectedFields: string[];
  conditions: ConditionGroup;
  matchCount: number;
  previewRows: Record<string, any>[];
}

export function isLeaf(node: ConditionLeaf | ConditionGroup): node is ConditionLeaf {
  return (node as ConditionLeaf).field !== undefined;
}

export function operatorsForFieldType(fieldType: string): string[] {
  switch (fieldType) {
    case 'text': return ['equals', 'not_equals', 'contains', 'not_contains'];
    case 'combobox': return ['equals', 'not_equals'];
    case 'number': return ['equals', 'not_equals', 'lt', 'gt'];
    case 'date': return ['older_than', 'newer_than', 'is_between'];
    default: return ['equals', 'not_equals'];
  }
}
