export type BugSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface BugReport {
  id: string;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  screenshot_url: string | null;
  device_info: Record<string, unknown> | null;
  user_details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BugReportInsert {
  title: string;
  description: string;
  severity: BugSeverity;
  screenshot_url?: string;
  device_info?: Record<string, unknown>;
  user_details?: Record<string, unknown>;
}