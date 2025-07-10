// src/frontend/src/services/foreclosureService.ts

export interface ForeclosureSummary {
  totalInForeclosure: number;
  judicialCount: number;
  nonJudicialCount: number;
  avgDaysInProcess: number;
  completedForeclosures: number;
  statusBreakdown: {
    [milestone: string]: number;
  };
  riskDistribution: {
    overdue: number;
    onTrack: number;
    completed: number;
  };
}

export interface ForeclosureLoan {
  loanId: string;
  borrowerName: string;
  state: string;
  jurisdiction: string;
  currentMilestone: string;
  fcStartDate: string;
  daysInProcess: number;
  expectedCompletionDate: string;
  actualCompletionDate?: string;
  status: 'overdue' | 'on_track' | 'completed';
  principalBalance: number;
}

export interface ForeclosureStateData {
  state: string;
  totalLoans: number;
  judicialCount: number;
  nonJudicialCount: number;
  avgDaysInProcess: number;
  completedCount: number;
}

class ForeclosureService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_BASE_URL || '';
  }

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${this.apiUrl}/api${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async getForeclosureSummary(): Promise<ForeclosureSummary> {
    return this.makeRequest<ForeclosureSummary>('/foreclosure/summary');
  }

  async getForeclosureLoans(): Promise<ForeclosureLoan[]> {
    return this.makeRequest<ForeclosureLoan[]>('/foreclosure/loans');
  }

  async getForeclosureByState(): Promise<ForeclosureStateData[]> {
    return this.makeRequest<ForeclosureStateData[]>('/foreclosure/by-state');
  }

  async getForeclosureTimeline(loanId: string): Promise<any[]> {
    return this.makeRequest<any[]>(`/loans/${loanId}/foreclosure-timeline`);
  }
}

export const foreclosureService = new ForeclosureService();