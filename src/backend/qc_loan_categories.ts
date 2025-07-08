import pool from './src/db';

interface LoanData {
  loan_id: string;
  next_pymt_due: string;
  last_pymt_received: string;
  fc_status?: string;
  january_2025?: number;
  february_2025?: number;
  march_2025?: number;
  april_2025?: number;
  may_2025?: number;
  june_2025?: number;
  july_2025?: number;
  august_2025?: number;
  september_2025?: number;
  october_2025?: number;
  november_2025?: number;
  december_2025?: number;
  prin_bal: string;
}

// Mirror the frontend categorization logic exactly
const countConsecutivePayments = (loan: LoanData): number => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11
  const currentYear = currentDate.getFullYear();
  
  const allMonths = [
    { month: 'december_2025', value: loan.december_2025, monthIndex: 11 },
    { month: 'november_2025', value: loan.november_2025, monthIndex: 10 },
    { month: 'october_2025', value: loan.october_2025, monthIndex: 9 },
    { month: 'september_2025', value: loan.september_2025, monthIndex: 8 },
    { month: 'august_2025', value: loan.august_2025, monthIndex: 7 },
    { month: 'july_2025', value: loan.july_2025, monthIndex: 6 },
    { month: 'june_2025', value: loan.june_2025, monthIndex: 5 },
    { month: 'may_2025', value: loan.may_2025, monthIndex: 4 },
    { month: 'april_2025', value: loan.april_2025, monthIndex: 3 },
    { month: 'march_2025', value: loan.march_2025, monthIndex: 2 },
    { month: 'february_2025', value: loan.february_2025, monthIndex: 1 },
    { month: 'january_2025', value: loan.january_2025, monthIndex: 0 }
  ];
  
  const relevantMonths = allMonths.filter(m => {
    if (currentYear === 2025) {
      return m.monthIndex <= currentMonth;
    } else if (currentYear > 2025) {
      return true;
    } else {
      return false;
    }
  });
  
  let consecutiveCount = 0;
  for (const monthData of relevantMonths) {
    const payment = parseFloat(String(monthData.value || '0'));
    if (payment > 0) {
      consecutiveCount++;
    } else {
      break;
    }
  }
  return consecutiveCount;
};

const countRecentPayments = (loan: LoanData, monthsBack: number): number => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const allMonths = [
    { value: loan.december_2025, monthIndex: 11 },
    { value: loan.november_2025, monthIndex: 10 },
    { value: loan.october_2025, monthIndex: 9 },
    { value: loan.september_2025, monthIndex: 8 },
    { value: loan.august_2025, monthIndex: 7 },
    { value: loan.july_2025, monthIndex: 6 },
    { value: loan.june_2025, monthIndex: 5 },
    { value: loan.may_2025, monthIndex: 4 },
    { value: loan.april_2025, monthIndex: 3 },
    { value: loan.march_2025, monthIndex: 2 },
    { value: loan.february_2025, monthIndex: 1 },
    { value: loan.january_2025, monthIndex: 0 }
  ];
  
  const relevantMonths = allMonths.filter(m => {
    if (currentYear === 2025) {
      return m.monthIndex <= currentMonth;
    } else if (currentYear > 2025) {
      return true;
    } else {
      return false;
    }
  });
  
  let paymentCount = 0;
  for (let i = 0; i < Math.min(monthsBack, relevantMonths.length); i++) {
    const payment = parseFloat(String(relevantMonths[i].value || '0'));
    if (payment > 0) paymentCount++;
  }
  return paymentCount;
};

const isPastDue = (loan: LoanData): boolean => {
  if (!loan.next_pymt_due) return false;
  const nextDueDate = new Date(loan.next_pymt_due);
  const today = new Date();
  return nextDueDate < today;
};

async function qcLoanCategories() {
  try {
    console.log('🔍 QC Analysis Starting...');
    console.log('Current Date:', new Date().toISOString());
    console.log('Current Month Index:', new Date().getMonth(), '(0=Jan, 6=Jul)');
    console.log('Current Year:', new Date().getFullYear());
    console.log('');
    
    // Get all loan data
    const query = `
      SELECT
        dmc.loan_id,
        dmc.next_pymt_due,
        dmc.last_pymt_received,
        dmc.prin_bal,
        dmc.january_2025,
        dmc.february_2025,
        dmc.march_2025,
        dmc.april_2025,
        dmc.may_2025,
        dmc.june_2025,
        dmc.july_2025,
        dmc.august_2025,
        dmc.september_2025,
        dmc.october_2025,
        dmc.november_2025,
        dmc.december_2025,
        fe.fc_status
      FROM daily_metrics_current dmc
      LEFT JOIN foreclosure_events fe ON dmc.loan_id = fe.loan_id
      ORDER BY dmc.loan_id
    `;
    
    const result = await pool.query(query);
    const loans = result.rows;
    
    console.log(`📊 Total Loans Found: ${loans.length}`);
    console.log('');
    
    // Initialize categories
    const categories = {
      securitizable: { loans: [] as LoanData[], count: 0, totalUpb: 0 },
      steadyPerforming: { loans: [] as LoanData[], count: 0, totalUpb: 0 },
      recentPerforming: { loans: [] as LoanData[], count: 0, totalUpb: 0 },
      paying: { loans: [] as LoanData[], count: 0, totalUpb: 0 },
      nonPerforming: { loans: [] as LoanData[], count: 0, totalUpb: 0 },
      foreclosure: { loans: [] as LoanData[], count: 0, totalUpb: 0 }
    };
    
    // Analyze first 10 loans in detail
    console.log('🔍 Detailed Analysis of First 10 Loans:');
    console.log('='.repeat(80));
    
    for (let i = 0; i < Math.min(10, loans.length); i++) {
      const loan = loans[i];
      const upb = parseFloat(loan.prin_bal) || 0;
      
      console.log(`\nLoan ${loan.loan_id}:`);
      console.log(`  UPB: $${upb.toLocaleString()}`);
      console.log(`  Next Payment Due: ${loan.next_pymt_due}`);
      console.log(`  Last Payment Received: ${loan.last_pymt_received}`);
      console.log(`  FC Status: ${loan.fc_status || 'None'}`);
      console.log(`  Payment History:`);
      console.log(`    Jan 2025: ${loan.january_2025 || 'null'}`);
      console.log(`    Feb 2025: ${loan.february_2025 || 'null'}`);
      console.log(`    Mar 2025: ${loan.march_2025 || 'null'}`);
      console.log(`    Apr 2025: ${loan.april_2025 || 'null'}`);
      console.log(`    May 2025: ${loan.may_2025 || 'null'}`);
      console.log(`    Jun 2025: ${loan.june_2025 || 'null'}`);
      console.log(`    Jul 2025: ${loan.july_2025 || 'null'}`);
      
      // Check for foreclosure first
      if (loan.fc_status && ['Active', 'Hold', 'FC', 'Foreclosure'].includes(loan.fc_status)) {
        console.log(`  📋 Category: FORECLOSURE (FC Status: ${loan.fc_status})`);
        continue;
      }
      
      const consecutivePayments = countConsecutivePayments(loan);
      const recentPayments = countRecentPayments(loan, 4);
      const monthsSinceLastPayment = loan.last_pymt_received ? 
        Math.floor((new Date().getTime() - new Date(loan.last_pymt_received).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 999;
      const pastDue = isPastDue(loan);
      
      console.log(`  📊 Analysis:`);
      console.log(`    Consecutive Payments: ${consecutivePayments}`);
      console.log(`    Recent Payments (last 4 months): ${recentPayments}`);
      console.log(`    Months Since Last Payment: ${monthsSinceLastPayment}`);
      console.log(`    Past Due: ${pastDue}`);
      
      // Check if has payment data
      const hasPaymentData = loan.january_2025 || loan.february_2025 || loan.march_2025 || 
                            loan.april_2025 || loan.may_2025 || loan.june_2025 || loan.july_2025;
      
      if (!hasPaymentData) {
        const loanIndex = parseInt(loan.loan_id.replace(/\D/g, '')) || 0;
        const distribution = loanIndex % 10;
        console.log(`  ⚠️  No Payment Data - Using Fallback Distribution (${distribution})`);
        
        if (distribution <= 2) {
          console.log(`  📋 Category: SECURITIZABLE (Fallback)`);
        } else if (distribution <= 4) {
          console.log(`  📋 Category: STEADY PERFORMING (Fallback)`);
        } else if (distribution <= 5) {
          console.log(`  📋 Category: RECENT PERFORMING (Fallback)`);
        } else if (distribution <= 7) {
          console.log(`  📋 Category: PAYING (Fallback)`);
        } else if (distribution <= 8) {
          console.log(`  📋 Category: NON-PERFORMING (Fallback)`);
        } else {
          console.log(`  📋 Category: FORECLOSURE (Fallback)`);
        }
        continue;
      }
      
      // Apply categorization logic
      if (consecutivePayments >= 12) {
        console.log(`  📋 Category: SECURITIZABLE (${consecutivePayments} consecutive payments)`);
      } else if (consecutivePayments >= 6 && !pastDue) {
        console.log(`  📋 Category: STEADY PERFORMING (${consecutivePayments} consecutive payments, not past due)`);
      } else if (consecutivePayments >= 1 && consecutivePayments <= 3 && !pastDue) {
        console.log(`  📋 Category: RECENT PERFORMING (${consecutivePayments} consecutive payments, not past due)`);
      } else if (pastDue && recentPayments >= 2) {
        console.log(`  📋 Category: PAYING (past due but ${recentPayments} recent payments)`);
      } else if (monthsSinceLastPayment >= 6) {
        console.log(`  📋 Category: NON-PERFORMING (${monthsSinceLastPayment} months since last payment)`);
      } else {
        console.log(`  📋 Category: PAYING (default)`);
      }
    }
    
    // Now categorize all loans
    console.log('\n' + '='.repeat(80));
    console.log('📈 Categorizing All Loans...');
    
    for (const loan of loans) {
      const upb = parseFloat(loan.prin_bal) || 0;
      
      // Check for foreclosure status first
      if (loan.fc_status && ['Active', 'Hold', 'FC', 'Foreclosure'].includes(loan.fc_status)) {
        categories.foreclosure.loans.push(loan);
        categories.foreclosure.count++;
        categories.foreclosure.totalUpb += upb;
        continue;
      }
      
      const consecutivePayments = countConsecutivePayments(loan);
      const recentPayments = countRecentPayments(loan, 4);
      const monthsSinceLastPayment = loan.last_pymt_received ? 
        Math.floor((new Date().getTime() - new Date(loan.last_pymt_received).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 999;
      const pastDue = isPastDue(loan);
      
      // If no payment history data exists, create realistic distribution
      const hasPaymentData = loan.january_2025 || loan.february_2025 || loan.march_2025 || 
                            loan.april_2025 || loan.may_2025 || loan.june_2025 || loan.july_2025;
      
      if (!hasPaymentData) {
        const loanIndex = parseInt(loan.loan_id.replace(/\D/g, '')) || 0;
        const distribution = loanIndex % 10;
        
        if (distribution <= 2) {
          categories.securitizable.loans.push(loan);
          categories.securitizable.count++;
          categories.securitizable.totalUpb += upb;
        } else if (distribution <= 4) {
          categories.steadyPerforming.loans.push(loan);
          categories.steadyPerforming.count++;
          categories.steadyPerforming.totalUpb += upb;
        } else if (distribution <= 5) {
          categories.recentPerforming.loans.push(loan);
          categories.recentPerforming.count++;
          categories.recentPerforming.totalUpb += upb;
        } else if (distribution <= 7) {
          categories.paying.loans.push(loan);
          categories.paying.count++;
          categories.paying.totalUpb += upb;
        } else if (distribution <= 8) {
          categories.nonPerforming.loans.push(loan);
          categories.nonPerforming.count++;
          categories.nonPerforming.totalUpb += upb;
        } else {
          categories.foreclosure.loans.push(loan);
          categories.foreclosure.count++;
          categories.foreclosure.totalUpb += upb;
        }
        continue;
      }
      
      // Categorize based on payment history
      if (consecutivePayments >= 12) {
        categories.securitizable.loans.push(loan);
        categories.securitizable.count++;
        categories.securitizable.totalUpb += upb;
      } else if (consecutivePayments >= 6 && !pastDue) {
        categories.steadyPerforming.loans.push(loan);
        categories.steadyPerforming.count++;
        categories.steadyPerforming.totalUpb += upb;
      } else if (consecutivePayments >= 1 && consecutivePayments <= 3 && !pastDue) {
        categories.recentPerforming.loans.push(loan);
        categories.recentPerforming.count++;
        categories.recentPerforming.totalUpb += upb;
      } else if (pastDue && recentPayments >= 2) {
        categories.paying.loans.push(loan);
        categories.paying.count++;
        categories.paying.totalUpb += upb;
      } else if (monthsSinceLastPayment >= 6) {
        categories.nonPerforming.loans.push(loan);
        categories.nonPerforming.count++;
        categories.nonPerforming.totalUpb += upb;
      } else {
        categories.paying.loans.push(loan);
        categories.paying.count++;
        categories.paying.totalUpb += upb;
      }
    }
    
    // Print final results
    console.log('\n📊 FINAL CATEGORIZATION RESULTS:');
    console.log('='.repeat(80));
    
    Object.entries(categories).forEach(([category, data]) => {
      console.log(`\n${category.toUpperCase()}:`);
      console.log(`  Count: ${data.count}`);
      console.log(`  Total UPB: $${data.totalUpb.toLocaleString()}`);
      console.log(`  Avg Balance: $${data.count > 0 ? (data.totalUpb / data.count).toLocaleString() : 0}`);
      console.log(`  Percentage: ${((data.count / loans.length) * 100).toFixed(1)}%`);
      
      if (data.count > 0) {
        console.log(`  Sample Loan IDs: ${data.loans.slice(0, 5).map(l => l.loan_id).join(', ')}`);
      }
    });
    
    // Check for data quality issues
    console.log('\n🔍 DATA QUALITY CHECKS:');
    console.log('='.repeat(80));
    
    // Count loans with payment data vs fallback
    let loansWithPaymentData = 0;
    let loansWithoutPaymentData = 0;
    
    for (const loan of loans) {
      const hasPaymentData = loan.january_2025 || loan.february_2025 || loan.march_2025 || 
                            loan.april_2025 || loan.may_2025 || loan.june_2025 || loan.july_2025;
      if (hasPaymentData) {
        loansWithPaymentData++;
      } else {
        loansWithoutPaymentData++;
      }
    }
    
    console.log(`Loans with payment data: ${loansWithPaymentData}`);
    console.log(`Loans without payment data (using fallback): ${loansWithoutPaymentData}`);
    console.log(`Fallback percentage: ${((loansWithoutPaymentData / loans.length) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('Error in QC analysis:', error);
  } finally {
    await pool.end();
  }
}

qcLoanCategories();