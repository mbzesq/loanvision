export interface Alert {
  id: number;
  alertRuleId: number;
  loanId: string;
  documentId?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: number;
  acknowledgedByName?: string;
  resolvedAt?: string;
  resolvedBy?: number;
  resolvedByName?: string;
  
  // Joined data
  ruleName?: string;
  eventType?: string;
  ruleDescription?: string;
  propertyAddress?: string;
  borrowerName?: string;
  documentName?: string;
  
  // Action history
  actions?: AlertAction[];
}

export interface AlertAction {
  id: number;
  alertId: number;
  userId: number;
  userName: string;
  action: 'acknowledge' | 'investigate' | 'escalate' | 'resolve' | 'dismiss';
  notes?: string;
  createdAt: string;
}

export interface AlertStats {
  activeCount: number;
  acknowledgedCount: number;
  resolvedThisWeek: number;
  criticalActive: number;
  highActive: number;
  mediumActive: number;
  lowActive: number;
}

export interface AlertRule {
  id: number;
  name: string;
  description?: string;
  eventType: string;
  conditionJson: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  subscriptionId?: number;
  deliveryMethod?: 'in_app' | 'email' | 'sms';
  isSubscribed?: boolean;
}

export interface AlertFilters {
  status?: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  loanId?: string;
  eventType?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}