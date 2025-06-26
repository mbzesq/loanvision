// Shared type definitions for LoanVision

export interface ParsedLoan {
  // Primary identifiers
  'Loan ID'?: string | number;
  LoanID?: string | number;
  loan_id?: string | number;
  
  // Borrower information
  'Borrower Name'?: string;
  BorrowerName?: string;
  borrower_name?: string;
  
  'Co-Borrower Name'?: string;
  CoBorrowerName?: string;
  co_borrower_name?: string;
  
  // Property information
  'Property Address'?: string;
  PropertyAddress?: string;
  property_address?: string;
  
  City?: string;
  property_city?: string;
  
  State?: string;
  property_state?: string;
  
  'Zip Code'?: string | number;
  ZipCode?: string | number;
  property_zip?: string | number;
  
  // Loan financial information
  'Original Loan Amount'?: string | number;
  LoanAmount?: string | number;
  loan_amount?: string | number;
  
  'Interest Rate'?: string | number;
  InterestRate?: string | number;
  interest_rate?: string | number;
  
  'Maturity Date'?: string;
  MaturityDate?: string;
  maturity_date?: string;
  
  'Original Lender'?: string;
  OriginalLender?: string;
  original_lender?: string;
  
  // Current loan status
  UPB?: string | number;
  'Unpaid Principal Balance'?: string | number;
  unpaid_principal_balance?: string | number;
  
  'Accrued Interest'?: string | number;
  AccruedInterest?: string | number;
  accrued_interest?: string | number;
  
  'Total Balance'?: string | number;
  TotalBalance?: string | number;
  total_balance?: string | number;
  
  // Payment information
  'Last Payment Date'?: string;
  LastPaymentDate?: string;
  last_paid_date?: string;
  
  'Next Due Date'?: string;
  NextDueDate?: string;
  next_due_date?: string;
  
  'Remaining Term'?: string | number;
  RemainingTerm?: string | number;
  remaining_term_months?: string | number;
  
  // Legal and lien information
  'Legal Status'?: string;
  LegalStatus?: string;
  legal_status?: string;
  
  'Lien Position'?: string;
  LienPosition?: string;
  lien_position?: string;
  
  'Investor Name'?: string;
  InvestorName?: string;
  investor_name?: string;
  
  // Allow any additional fields
  [key: string]: any;
}

// Alias for backward compatibility
export type Loan = ParsedLoan;

// Authentication types
export type UserRole = 'super_user' | 'admin' | 'manager' | 'user';

export interface User {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface JWTPayload {
  id: number;
  email: string;
  role: UserRole;
}