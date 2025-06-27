// src/frontend/src/lib/loanUtils.tsx
import React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { getMilestoneStatus } from './timelineUtils';

// Interfaces
export interface Milestone {
  milestone_name: string;
  actual_completion_date: string | null;
  expected_completion_date: string | null;
}

// Reusable DetailItem component
export const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-sm text-slate-500">{label}</p>
    <div className="font-medium text-slate-900 mt-1">{children}</div>
  </div>
);

// Formatting functions
export const formatCurrency = (value: any) => 
  !value ? "—" : parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export const formatDate = (value: any) => {
  if (!value) return "—";
  const date = new Date(value);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const correctedDate = new Date(date.getTime() + userTimezoneOffset);
  return isNaN(correctedDate.getTime()) ? "—" : correctedDate.toLocaleDateString('en-US');
};

export const formatPercent = (value: any) => 
  !value ? "—" : `${(parseFloat(value) * 100).toFixed(2)}%`;

export const formatValue = (value: any) => value || "—";

// Helper functions
export const generateZillowUrl = (loan: any) => 
  loan ? `https://www.zillow.com/homes/${encodeURIComponent(`${loan.address}, ${loan.city}, ${loan.state} ${loan.zip}`)}` : '#';

export const handleInvestorClick = (name: string | null | undefined) => 
  alert(`Investor view for ${name || 'N/A'} coming soon!`);

export const getStatusIcon = (milestone: Milestone) => {
  const status = getMilestoneStatus(milestone.actual_completion_date, milestone.expected_completion_date);

  if (status === 'COMPLETED_ON_TIME') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === 'COMPLETED_LATE' || status === 'PENDING_OVERDUE') return <AlertCircle className="h-5 w-5 text-red-500" />;
  return <Clock className="h-5 w-5 text-slate-400" />;
};