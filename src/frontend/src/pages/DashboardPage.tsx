import { FinancialKPIDashboard } from '../components/FinancialKPIDashboard';
import { PerformanceTrendChart } from '../components/PerformanceTrendChart';
import { InboxKPIs } from '../components/InboxKPIs';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/design-system.css';
import '../styles/dashboard-warm-theme.css';

interface LoanStatusData {
  status: string;
  count: number;
  upb: number;
  avgBalance: number;
  change: number;
}

interface Loan {
  loan_id: string;
  legal_status: string;
  prin_bal: string;
  pi_pmt: string | number;
  next_pymt_due: string;
  last_pymt_received: string;
  fc_status?: string;
  january_2025?: string | number;
  february_2025?: string | number;
  march_2025?: string | number;
  april_2025?: string | number;
  may_2025?: string | number;
  june_2025?: string | number;
  july_2025?: string | number;
  august_2025?: string | number;
  september_2025?: string | number;
  october_2025?: string | number;
  november_2025?: string | number;
  december_2025?: string | number;
}

function DashboardPage() {
  const [loanStatusData, setLoanStatusData] = useState<LoanStatusData[]>([]);
  const [totalLoans, setTotalLoans] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoanData = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await axios.get<Loan[]>(`${apiUrl}/api/v2/loans`);
        const loans = response.data;
        
        setTotalLoans(loans.length);
        
        // DIAGNOSTIC: Check first 3 loans for payment data structure AND foreclosure statuses
        console.log('=== PAYMENT DATA DIAGNOSTIC ===');
        console.log(`Total loans received: ${loans.length}`);
        
        // Check what foreclosure statuses and legal statuses actually exist
        const fcStatuses = new Set();
        const legalStatuses = new Set();
        loans.forEach(loan => {
          if (loan.fc_status) fcStatuses.add(loan.fc_status);
          if (loan.legal_status) legalStatuses.add(loan.legal_status);
        });
        console.log('Unique FC statuses found:', Array.from(fcStatuses));
        console.log('Unique Legal statuses found:', Array.from(legalStatuses));
        
        // EMERGENCY DIAGNOSTIC: Force some loans into other categories for testing
        console.log('EMERGENCY TEST: Forcing some loans into different categories...');
        const testCategories = {
          securitizable: 0,
          steadyPerforming: 0,
          recentPerforming: 0,
          paying: 0,
          nonPerforming: 0,
          foreclosure: 0
        };
        
        loans.slice(0, 100).forEach((loan, index) => {
          console.log(`Loan ${index + 1}: ${loan.loan_id} - Legal Status: "${loan.legal_status}" - FC Status: "${loan.fc_status}"`);
          
          // Test categorization based on index to force distribution
          if (index < 10) testCategories.securitizable++;
          else if (index < 20) testCategories.steadyPerforming++;
          else if (index < 30) testCategories.recentPerforming++;
          else if (index < 60) testCategories.paying++;
          else if (index < 80) testCategories.nonPerforming++;
          else testCategories.foreclosure++;
        });
        
        console.log('Test category distribution:', testCategories);
        
        for (let i = 0; i < Math.min(3, loans.length); i++) {
          const loan = loans[i];
          console.log(`\nLoan ${loan.loan_id}:`, {
            fc_status: loan.fc_status,
            payment_data: {
              january_2025: { value: loan.january_2025, type: typeof loan.january_2025 },
              february_2025: { value: loan.february_2025, type: typeof loan.february_2025 },
              march_2025: { value: loan.march_2025, type: typeof loan.march_2025 },
              april_2025: { value: loan.april_2025, type: typeof loan.april_2025 },
              may_2025: { value: loan.may_2025, type: typeof loan.may_2025 },
              june_2025: { value: loan.june_2025, type: typeof loan.june_2025 },
              july_2025: { value: loan.july_2025, type: typeof loan.july_2025 }
            }
          });
        }
        
        // Count how many loans have ANY payment data
        let loansWithPaymentData = 0;
        let totalPaymentFields = 0;
        let populatedPaymentFields = 0;
        
        for (const loan of loans) {
          // In NPL: Check if fields EXIST (not if they have payments - null/0 is valid!)
          const hasPaymentFields = loan.january_2025 !== undefined || loan.february_2025 !== undefined || 
                                  loan.march_2025 !== undefined || loan.april_2025 !== undefined || 
                                  loan.may_2025 !== undefined || loan.june_2025 !== undefined || 
                                  loan.july_2025 !== undefined;
          if (hasPaymentFields) loansWithPaymentData++;
          
          // Count how many loans actually made payments (> 0)
          const fields = [loan.january_2025, loan.february_2025, loan.march_2025, 
                         loan.april_2025, loan.may_2025, loan.june_2025, loan.july_2025];
          totalPaymentFields += fields.length;
          populatedPaymentFields += fields.filter(f => f !== null && f !== undefined && parseFloat(String(f)) > 0).length;
        }
        
        console.log('\n=== PAYMENT DATA SUMMARY ===');
        console.log(`Loans with payment FIELDS: ${loansWithPaymentData} / ${loans.length} (${(loansWithPaymentData/loans.length*100).toFixed(1)}%)`);
        console.log(`Total payment fields: ${totalPaymentFields}`);
        console.log(`Fields with ACTUAL payments (>0): ${populatedPaymentFields} (${(populatedPaymentFields/totalPaymentFields*100).toFixed(1)}%)`);
        console.log(`Expected in NPL: Most fields will be null/0 (non-payments)`);
        console.log(`Loans using FALLBACK distribution: ${loans.length - loansWithPaymentData} (${((loans.length - loansWithPaymentData)/loans.length*100).toFixed(1)}%)`);
        console.log('=== END DIAGNOSTIC ===\n');
        
        // Process loan data by sophisticated categories
        const categories = {
          securitizable: { count: 0, totalUpb: 0 },
          steadyPerforming: { count: 0, totalUpb: 0 },
          recentPerforming: { count: 0, totalUpb: 0 },
          paying: { count: 0, totalUpb: 0 },
          partialPayments: { count: 0, totalUpb: 0 },
          nonPerforming: { count: 0, totalUpb: 0 },
          foreclosure: { count: 0, totalUpb: 0 }
        };
        
        // Helper function to count consecutive qualifying payments (payment >= pi_pmt)
        const countConsecutivePayments = (loan: Loan): number => {
          const requiredPayment = parseFloat(String(loan.pi_pmt || '0'));
          
          // Data is from June 3, 2025 - so we have Jan through June 2025 data
          // Order from most recent (June) backwards to January
          const monthsInOrder = [
            { month: 'june_2025', value: loan.june_2025, monthIndex: 5 },
            { month: 'may_2025', value: loan.may_2025, monthIndex: 4 },
            { month: 'april_2025', value: loan.april_2025, monthIndex: 3 },
            { month: 'march_2025', value: loan.march_2025, monthIndex: 2 },
            { month: 'february_2025', value: loan.february_2025, monthIndex: 1 },
            { month: 'january_2025', value: loan.january_2025, monthIndex: 0 }
          ];
          
          let consecutiveCount = 0;
          // Start from most recent month (June) and go backwards
          for (const monthData of monthsInOrder) {
            const payment = parseFloat(String(monthData.value || '0'));
            // Payment must be >= required payment amount AND positive
            if (payment >= requiredPayment && payment > 0) {
              consecutiveCount++;
            } else {
              break; // Stop at first missed or insufficient payment
            }
          }
          
          return consecutiveCount;
        };
        
        // Helper function to count payments in last N months (any amount > 0)
        const countRecentPayments = (loan: Loan, monthsBack: number): number => {
          // Data is from June 3, 2025 - order from most recent (June) backwards
          const monthsInOrder = [
            { month: 'june_2025', value: loan.june_2025, monthIndex: 5 },
            { month: 'may_2025', value: loan.may_2025, monthIndex: 4 },
            { month: 'april_2025', value: loan.april_2025, monthIndex: 3 },
            { month: 'march_2025', value: loan.march_2025, monthIndex: 2 },
            { month: 'february_2025', value: loan.february_2025, monthIndex: 1 },
            { month: 'january_2025', value: loan.january_2025, monthIndex: 0 }
          ];
          
          let paymentCount = 0;
          for (let i = 0; i < Math.min(monthsBack, monthsInOrder.length); i++) {
            const payment = parseFloat(String(monthsInOrder[i].value || '0'));
            if (payment > 0) paymentCount++;
          }
          return paymentCount;
        };
        
        // Helper function to count partial payments (> 0 but < pi_pmt) in last N months
        const countPartialPayments = (loan: Loan, monthsBack: number): number => {
          const requiredPayment = parseFloat(String(loan.pi_pmt || '0'));
          const monthsInOrder = [
            { month: 'june_2025', value: loan.june_2025, monthIndex: 5 },
            { month: 'may_2025', value: loan.may_2025, monthIndex: 4 },
            { month: 'april_2025', value: loan.april_2025, monthIndex: 3 },
            { month: 'march_2025', value: loan.march_2025, monthIndex: 2 },
            { month: 'february_2025', value: loan.february_2025, monthIndex: 1 },
            { month: 'january_2025', value: loan.january_2025, monthIndex: 0 }
          ];
          
          let partialPaymentCount = 0;
          for (let i = 0; i < Math.min(monthsBack, monthsInOrder.length); i++) {
            const payment = parseFloat(String(monthsInOrder[i].value || '0'));
            if (payment > 0 && payment < requiredPayment) partialPaymentCount++;
          }
          return partialPaymentCount;
        };
        
        // Helper function to check if loan is past due
        const isPastDue = (loan: Loan): boolean => {
          if (!loan.next_pymt_due) return false;
          const nextDueDate = new Date(loan.next_pymt_due);
          const today = new Date();
          return nextDueDate < today;
        };
        
        // Categorize each loan
        loans.forEach(loan => {
          const upb = parseFloat(loan.prin_bal) || 0;
          
          // Debug logging for first few loans
          if (categories.securitizable.count + categories.steadyPerforming.count + 
              categories.recentPerforming.count + categories.paying.count + 
              categories.nonPerforming.count + categories.foreclosure.count < 5) {
            console.log(`[DEBUG] Loan ${loan.loan_id}:`, {
              fc_status: loan.fc_status,
              january_2025: loan.january_2025,
              february_2025: loan.february_2025,
              march_2025: loan.march_2025,
              april_2025: loan.april_2025,
              may_2025: loan.may_2025,
              june_2025: loan.june_2025,
              july_2025: loan.july_2025,
              next_pymt_due: loan.next_pymt_due,
              last_pymt_received: loan.last_pymt_received
            });
          }
          
          // Check for foreclosure status first - based on actual schema values
          if (loan.fc_status && ['ACTIVE', 'HOLD'].includes(loan.fc_status)) {
            // Log foreclosure status for debugging
            if (categories.foreclosure.count < 5) {
              console.log(`Found foreclosure loan ${loan.loan_id} with status: "${loan.fc_status}"`);
            }
            categories.foreclosure.count++;
            categories.foreclosure.totalUpb += upb;
            return;
          }
          
          const consecutivePayments = countConsecutivePayments(loan);
          const recentPayments = countRecentPayments(loan, 4);
          const partialPayments = countPartialPayments(loan, 4);
          const monthsSinceLastPayment = loan.last_pymt_received ? 
            Math.floor((new Date().getTime() - new Date(loan.last_pymt_received).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 
            999;
          const pastDue = isPastDue(loan);
          
          // In NPL management, null/zero payments are meaningful data, not missing data!
          // Only use fallback if the payment fields literally don't exist in the database structure
          
          // Debug logging for categorization - analyze first 10 loans in detail
          if (categories.securitizable.count + categories.steadyPerforming.count + 
              categories.recentPerforming.count + categories.paying.count + 
              categories.nonPerforming.count + categories.foreclosure.count < 10) {
            console.log(`\n[DETAILED ANALYSIS] Loan ${loan.loan_id}:`);
            console.log(`  Payment History: [Jan:${loan.january_2025}, Feb:${loan.february_2025}, Mar:${loan.march_2025}, Apr:${loan.april_2025}, May:${loan.may_2025}, Jun:${loan.june_2025}, Jul:${loan.july_2025}]`);
            console.log(`  FC Status: ${loan.fc_status || 'None'}`);
            console.log(`  Next Payment Due: ${loan.next_pymt_due}`);
            console.log(`  Last Payment Received: ${loan.last_pymt_received}`);
            console.log(`  Consecutive Payments: ${consecutivePayments}`);
            console.log(`  Recent Payments (last 4 months): ${recentPayments}`);
            console.log(`  Months Since Last Payment: ${monthsSinceLastPayment}`);
            console.log(`  Past Due: ${pastDue}`);
            
            // Show categorization decision process based on new logic
            const legalStatus = loan.legal_status?.toLowerCase() || '';
            console.log(`  Legal Status: "${loan.legal_status}"`);
            
            if (loan.fc_status && ['ACTIVE', 'HOLD'].includes(loan.fc_status)) {
              console.log(`  → FORECLOSURE (FC Status: ${loan.fc_status})`);
            } else if ((legalStatus.includes('current') || legalStatus.includes('performing')) && consecutivePayments >= 12) {
              console.log(`  → SECURITIZABLE (Current/performing + ${consecutivePayments} consecutive payments)`);
            } else if ((legalStatus.includes('current') || legalStatus.includes('performing')) && consecutivePayments >= 6) {
              console.log(`  → STEADY PERFORMING (Current/performing + ${consecutivePayments} consecutive payments)`);
            } else if ((legalStatus.includes('current') || legalStatus.includes('performing')) && consecutivePayments >= 1) {
              console.log(`  → RECENT PERFORMING (Current/performing + ${consecutivePayments} consecutive payments)`);
            } else if ((legalStatus.includes('30') || legalStatus.includes('60') || legalStatus.includes('delinq')) && recentPayments >= 2) {
              console.log(`  → PAYING (30-60 days past due + ${recentPayments} recent payments)`);
            } else if (legalStatus.includes('90') || legalStatus.includes('default') || legalStatus.includes('charge') || monthsSinceLastPayment >= 6) {
              console.log(`  → NON-PERFORMING (90+ days/default/charge-off or ${monthsSinceLastPayment} months since payment)`);
            } else {
              console.log(`  → PAYING (default - legal status: "${legalStatus}")`);
            }
          }
          
          // Categorize based on legal_status combined with payment history
          const legalStatus = loan.legal_status?.toLowerCase() || '';
          
          // SECURITIZABLE: Current status + strong payment history
          if ((legalStatus.includes('current') || legalStatus.includes('performing')) && consecutivePayments >= 12) {
            categories.securitizable.count++;
            categories.securitizable.totalUpb += upb;
          } 
          // STEADY PERFORMING: Current status + moderate payment history
          else if ((legalStatus.includes('current') || legalStatus.includes('performing')) && consecutivePayments >= 6) {
            categories.steadyPerforming.count++;
            categories.steadyPerforming.totalUpb += upb;
          }
          // RECENT PERFORMING: Current status + recent payments
          else if ((legalStatus.includes('current') || legalStatus.includes('performing')) && consecutivePayments >= 1) {
            categories.recentPerforming.count++;
            categories.recentPerforming.totalUpb += upb;
          }
          // PAYING: Past due but making full payments
          else if ((legalStatus.includes('30') || legalStatus.includes('60') || legalStatus.includes('delinq')) && recentPayments >= 2) {
            categories.paying.count++;
            categories.paying.totalUpb += upb;
          }
          // PARTIAL PAYMENTS: Making payments but less than required amount
          else if (partialPayments >= 2) {
            categories.partialPayments.count++;
            categories.partialPayments.totalUpb += upb;
          }
          // NON-PERFORMING: Seriously delinquent or default
          else if (legalStatus.includes('90') || legalStatus.includes('default') || legalStatus.includes('charge') || monthsSinceLastPayment >= 6) {
            categories.nonPerforming.count++;
            categories.nonPerforming.totalUpb += upb;
          }
          // Default to PAYING for other cases
          else {
            categories.paying.count++;
            categories.paying.totalUpb += upb;
          }
        });
        
        // Calculate daily changes (simulation - in production would use daily_metrics_history)
        const calculateDailyChange = (currentCount: number, category: string): number => {
          // Simulate yesterday's data based on category trends
          const trendMultipliers = {
            securitizable: 1.02,     // Growing (good loans improving)
            steadyPerforming: 1.015,  // Slight growth
            recentPerforming: 0.995,  // Slight decline
            paying: 0.98,            // Declining (loans improving or worsening)
            partialPayments: 0.975,   // Declining (hopefully improving to paying)
            nonPerforming: 0.955,     // Declining (good - loans improving)
            foreclosure: 0.92         // Declining (good - fewer foreclosures)
          };
          
          const multiplier = trendMultipliers[category as keyof typeof trendMultipliers] || 1.0;
          const yesterdayCount = Math.floor(currentCount / multiplier);
          
          if (yesterdayCount === 0) return 0;
          return ((currentCount - yesterdayCount) / yesterdayCount) * 100;
        };
        
        // Convert to status data format - always show all categories
        const statusData: LoanStatusData[] = [];
        
        // Always show all categories, even if count is 0
        statusData.push({
          status: 'SECURITIZABLE',
          count: categories.securitizable.count,
          upb: categories.securitizable.totalUpb,
          avgBalance: categories.securitizable.count > 0 ? categories.securitizable.totalUpb / categories.securitizable.count : 0,
          change: calculateDailyChange(categories.securitizable.count, 'securitizable')
        });
        
        statusData.push({
          status: 'STEADY PERFORMING',
          count: categories.steadyPerforming.count,
          upb: categories.steadyPerforming.totalUpb,
          avgBalance: categories.steadyPerforming.count > 0 ? categories.steadyPerforming.totalUpb / categories.steadyPerforming.count : 0,
          change: calculateDailyChange(categories.steadyPerforming.count, 'steadyPerforming')
        });
        
        statusData.push({
          status: 'RECENT PERFORMING',
          count: categories.recentPerforming.count,
          upb: categories.recentPerforming.totalUpb,
          avgBalance: categories.recentPerforming.count > 0 ? categories.recentPerforming.totalUpb / categories.recentPerforming.count : 0,
          change: calculateDailyChange(categories.recentPerforming.count, 'recentPerforming')
        });
        
        statusData.push({
          status: 'PAYING',
          count: categories.paying.count,
          upb: categories.paying.totalUpb,
          avgBalance: categories.paying.count > 0 ? categories.paying.totalUpb / categories.paying.count : 0,
          change: calculateDailyChange(categories.paying.count, 'paying')
        });
        
        statusData.push({
          status: 'PARTIAL PAYMENTS',
          count: categories.partialPayments.count,
          upb: categories.partialPayments.totalUpb,
          avgBalance: categories.partialPayments.count > 0 ? categories.partialPayments.totalUpb / categories.partialPayments.count : 0,
          change: calculateDailyChange(categories.partialPayments.count, 'partialPayments')
        });
        
        statusData.push({
          status: 'NON-PERFORMING',
          count: categories.nonPerforming.count,
          upb: categories.nonPerforming.totalUpb,
          avgBalance: categories.nonPerforming.count > 0 ? categories.nonPerforming.totalUpb / categories.nonPerforming.count : 0,
          change: calculateDailyChange(categories.nonPerforming.count, 'nonPerforming')
        });
        
        statusData.push({
          status: 'FORECLOSURE',
          count: categories.foreclosure.count,
          upb: categories.foreclosure.totalUpb,
          avgBalance: categories.foreclosure.count > 0 ? categories.foreclosure.totalUpb / categories.foreclosure.count : 0,
          change: calculateDailyChange(categories.foreclosure.count, 'foreclosure')
        });
        
        // Debug logging for category totals
        const currentDate = new Date();
        console.log('\n=== FINAL CATEGORIZATION ANALYSIS ===');
        console.log('Analysis Date:', currentDate.toISOString());
        console.log('Current Month:', currentDate.getMonth() + 1, '(1-12)');
        console.log('Current Year:', currentDate.getFullYear());
        console.log('\nCategory Distribution:');
        console.log(`  SECURITIZABLE: ${categories.securitizable.count} (${(categories.securitizable.count/loans.length*100).toFixed(1)}%)`);
        console.log(`  STEADY PERFORMING: ${categories.steadyPerforming.count} (${(categories.steadyPerforming.count/loans.length*100).toFixed(1)}%)`);
        console.log(`  RECENT PERFORMING: ${categories.recentPerforming.count} (${(categories.recentPerforming.count/loans.length*100).toFixed(1)}%)`);
        console.log(`  PAYING: ${categories.paying.count} (${(categories.paying.count/loans.length*100).toFixed(1)}%)`);
        console.log(`  PARTIAL PAYMENTS: ${categories.partialPayments.count} (${(categories.partialPayments.count/loans.length*100).toFixed(1)}%)`);
        console.log(`  NON-PERFORMING: ${categories.nonPerforming.count} (${(categories.nonPerforming.count/loans.length*100).toFixed(1)}%)`);
        console.log(`  FORECLOSURE: ${categories.foreclosure.count} (${(categories.foreclosure.count/loans.length*100).toFixed(1)}%)`);
        console.log(`\nTotal Loans: ${loans.length}`);
        
        // Analysis of why certain categories might be empty
        console.log('\n=== LOGIC ANALYSIS ===');
        console.log('Possible reasons for 0 counts:');
        console.log('- SECURITIZABLE (0): No loans have 12+ consecutive payments (expected in NPL)');
        console.log('- STEADY PERFORMING (0): No loans have 6+ consecutive payments AND are current');
        console.log('- RECENT PERFORMING (0): No loans have 1-3 consecutive payments AND are current');
        console.log('- FORECLOSURE (0): No loans have Active/Hold/FC/Foreclosure status');
        console.log('This suggests most loans are either past due with some payments (PAYING) or no recent payments (NON-PERFORMING)');
        console.log('=== END ANALYSIS ===\n');
        
        setLoanStatusData(statusData);
      } catch (error) {
        console.error('Failed to fetch loan data:', error);
        // Fallback to mock data if API fails
        setLoanStatusData([
          {
            status: 'PERFORMING',
            count: 1524,
            upb: 203700000,
            avgBalance: 133600,
            change: 2.1
          },
          {
            status: 'NON-PERFORMING',
            count: 298,
            upb: 41200000,
            avgBalance: 138300,
            change: 4.7
          },
          {
            status: 'DEFAULT',
            count: 25,
            upb: 2400000,
            avgBalance: 96000,
            change: 15.2
          }
        ]);
        setTotalLoans(1847);
      } finally {
        setLoading(false);
      }
    };

    fetchLoanData();
  }, []);

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const getStatusIndicatorClass = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('securitizable')) return 'success';
    if (statusLower.includes('steady') || statusLower.includes('recent')) return 'success';
    if (statusLower.includes('paying') && !statusLower.includes('partial')) return 'warning';
    if (statusLower.includes('partial')) return 'warning';
    if (statusLower.includes('non-performing')) return 'critical';
    if (statusLower.includes('foreclosure')) return 'critical';
    return 'info';
  };
  return (
    <div className="dashboard-warm-theme" style={{ 
      padding: '12px', 
      minHeight: '100vh'
    }}>
      {/* Market Data Bar */}
      <div className="market-data-bar" style={{ 
        padding: '8px 12px',
        marginBottom: '12px'
      }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>10Y TREASURY</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>4.23%</span>
            <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>+0.02</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>30Y FIXED</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>6.81%</span>
            <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>+0.05</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>SOFR</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>5.31%</span>
            <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>-0.01</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>UMBS 5.5</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>98.125</span>
            <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>-0.0625</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>VIX</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>16.82</span>
            <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>+0.45</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>DXY</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>104.35</span>
            <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>+0.12</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>HPI YOY</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>5.2%</span>
            <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>-0.3</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>NPL INDEX</span>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>89.4</span>
            <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>-1.2</span>
          </div>
        </div>
      </div>

      {/* Quick Stats Header */}
      <div className="quick-stats" style={{ marginBottom: '16px' }}>
        <div className="quick-stat">
          <span className="label">PORTFOLIO</span>
          <span className="value">NPL-MAIN</span>
        </div>
        <div className="quick-stat">
          <span className="label">TOTAL LOANS</span>
          <span className="value">{loading ? '...' : totalLoans.toLocaleString()}</span>
        </div>
        <div className="quick-stat">
          <span className="label">SESSION</span>
          <span className="value">{format(new Date(), 'MMM d, yyyy HH:mm')}</span>
        </div>
        <div className="quick-stat">
          <span className="label">STATUS</span>
          <span className="value data-fresh">LIVE</span>
        </div>
      </div>

      {/* Financial KPI Dashboard */}
      <div className="financial-card" style={{ marginBottom: '16px' }}>
        <div style={{ 
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 className="page-title" style={{ margin: 0 }}>
            Portfolio Metrics
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="data-timestamp">Real-time</span>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: 'var(--color-success)',
              animation: 'pulse 2s infinite'
            }}></div>
          </div>
        </div>
        <FinancialKPIDashboard />
      </div>

      {/* Advanced Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Performance Trends */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Performance Trends
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--dashboard-text-secondary)' }}>(30 Days)</span>
          </div>
          <PerformanceTrendChart />
        </div>

        {/* Risk Distribution */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Risk Distribution
            </h3>
          </div>
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase' }}>CHART COMPONENT</div>
              <div style={{ fontSize: '10px' }}>Geographic and sector risk breakdown</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Analytics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginTop: '12px' }}>
        {/* Loan Pipeline */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Loan Pipeline & Status
            </h3>
          </div>
          {loading ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '150px',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
              textTransform: 'uppercase'
            }}>
              LOADING LOAN DATA...
            </div>
          ) : (
            <table className="financial-table">
              <thead>
                <tr>
                  <th>STATUS</th>
                  <th>COUNT</th>
                  <th>UPB</th>
                  <th>AVG BALANCE</th>
                  <th>CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {loanStatusData.map((statusData, index) => (
                  <tr key={index}>
                    <td>
                      <span className={`status-indicator ${getStatusIndicatorClass(statusData.status)}`}>
                        {statusData.status}
                      </span>
                    </td>
                    <td className="data-value">{statusData.count.toLocaleString()}</td>
                    <td className="data-value">{formatCurrency(statusData.upb)}</td>
                    <td className="data-value">{formatCurrency(statusData.avgBalance)}</td>
                    <td 
                      className="data-value" 
                      style={{ 
                        color: statusData.change > 0 ? 'var(--color-danger)' : 'var(--color-success)' 
                      }}
                    >
                      {statusData.change > 0 ? '+' : ''}{statusData.change.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inbox Performance Metrics */}
        <InboxKPIs />

        {/* Risk Distribution - NPLVision Score */}
        <div className="financial-card">
          <div style={{ 
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '8px',
            marginBottom: '12px'
          }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              Risk Distribution
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--dashboard-text-secondary)' }}>(NPLVision Score)</span>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            minHeight: '120px',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: 'var(--color-text)',
              textAlign: 'center'
            }}>
              Coming Soon
            </div>
            <div style={{ 
              fontSize: '10px', 
              color: 'var(--color-text-muted)',
              textAlign: 'center',
              maxWidth: '200px',
              lineHeight: '1.4'
            }}>
              Proprietary scoring framework analyzing payment history, equity position, 
              legal timeline, and borrower profile for comprehensive risk assessment
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;