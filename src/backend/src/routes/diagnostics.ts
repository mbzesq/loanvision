import { Router } from 'express';
import pool from '../db';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Get a sample of loans with payment history for manual QC
router.get('/sample-loans', authenticateToken, async (req, res) => {
  try {
    const sampleSize = parseInt(req.query.size as string) || 10;
    
    const query = `
      SELECT
        dmc.loan_id,
        dmc.prin_bal,
        dmc.next_pymt_due,
        dmc.last_pymt_received,
        dmc.legal_status,
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
        fe.fc_status,
        fe.fc_jurisdiction
      FROM daily_metrics_current dmc
      LEFT JOIN foreclosure_events fe ON dmc.loan_id = fe.loan_id
      ORDER BY dmc.loan_id
      LIMIT $1
    `;
    
    const result = await pool.query(query, [sampleSize]);
    const loans = result.rows;
    
    // Add categorization analysis for each loan
    const analyzedLoans = loans.map(loan => {
      // Mirror the frontend categorization logic
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth(); // 0-11
      const currentYear = currentDate.getFullYear();
      
      // Get payment history in order from most recent to oldest
      const paymentHistory = [
        { month: 'Jul 2025', value: loan.july_2025, monthIndex: 6 },
        { month: 'Jun 2025', value: loan.june_2025, monthIndex: 5 },
        { month: 'May 2025', value: loan.may_2025, monthIndex: 4 },
        { month: 'Apr 2025', value: loan.april_2025, monthIndex: 3 },
        { month: 'Mar 2025', value: loan.march_2025, monthIndex: 2 },
        { month: 'Feb 2025', value: loan.february_2025, monthIndex: 1 },
        { month: 'Jan 2025', value: loan.january_2025, monthIndex: 0 }
      ].filter(m => {
        if (currentYear === 2025) {
          return m.monthIndex <= currentMonth;
        } else if (currentYear > 2025) {
          return true;
        }
        return false;
      });
      
      // Count consecutive payments from most recent month backwards
      let consecutivePayments = 0;
      for (const monthData of paymentHistory) {
        const payment = parseFloat(String(monthData.value || '0'));
        if (payment > 0) {
          consecutivePayments++;
        } else {
          break;
        }
      }
      
      // Count recent payments (last 4 months)
      let recentPayments = 0;
      for (let i = 0; i < Math.min(4, paymentHistory.length); i++) {
        const payment = parseFloat(String(paymentHistory[i].value || '0'));
        if (payment > 0) recentPayments++;
      }
      
      // Check if past due
      const pastDue = loan.next_pymt_due ? new Date(loan.next_pymt_due) < new Date() : false;
      
      // Calculate months since last payment
      const monthsSinceLastPayment = loan.last_pymt_received ? 
        Math.floor((new Date().getTime() - new Date(loan.last_pymt_received).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 999;
      
      // Determine category
      let category = 'UNKNOWN';
      let reason = '';
      
      if (loan.fc_status && ['Active', 'Hold', 'FC', 'Foreclosure'].includes(loan.fc_status)) {
        category = 'FORECLOSURE';
        reason = `FC Status: ${loan.fc_status}`;
      } else if (consecutivePayments >= 12) {
        category = 'SECURITIZABLE';
        reason = `${consecutivePayments} consecutive payments`;
      } else if (consecutivePayments >= 6 && !pastDue) {
        category = 'STEADY PERFORMING';
        reason = `${consecutivePayments} consecutive payments, not past due`;
      } else if (consecutivePayments >= 1 && consecutivePayments <= 3 && !pastDue) {
        category = 'RECENT PERFORMING';
        reason = `${consecutivePayments} consecutive payments, not past due`;
      } else if (pastDue && recentPayments >= 2) {
        category = 'PAYING';
        reason = `Past due but ${recentPayments} recent payments`;
      } else if (monthsSinceLastPayment >= 6) {
        category = 'NON-PERFORMING';
        reason = `${monthsSinceLastPayment} months since last payment`;
      } else {
        category = 'PAYING';
        reason = 'Default catch-all';
      }
      
      return {
        loan_id: loan.loan_id,
        prin_bal: parseFloat(loan.prin_bal || '0'),
        legal_status: loan.legal_status,
        next_pymt_due: loan.next_pymt_due,
        last_pymt_received: loan.last_pymt_received,
        fc_status: loan.fc_status,
        payment_history: paymentHistory,
        analysis: {
          consecutive_payments: consecutivePayments,
          recent_payments: recentPayments,
          months_since_last_payment: monthsSinceLastPayment,
          past_due: pastDue,
          category: category,
          reason: reason
        }
      };
    });
    
    // Summary statistics
    const summary = {
      total_loans_sampled: loans.length,
      current_date: new Date().toISOString(),
      current_month: currentDate.getMonth() + 1,
      categories: {
        SECURITIZABLE: analyzedLoans.filter(l => l.analysis.category === 'SECURITIZABLE').length,
        'STEADY PERFORMING': analyzedLoans.filter(l => l.analysis.category === 'STEADY PERFORMING').length,
        'RECENT PERFORMING': analyzedLoans.filter(l => l.analysis.category === 'RECENT PERFORMING').length,
        PAYING: analyzedLoans.filter(l => l.analysis.category === 'PAYING').length,
        'NON-PERFORMING': analyzedLoans.filter(l => l.analysis.category === 'NON-PERFORMING').length,
        FORECLOSURE: analyzedLoans.filter(l => l.analysis.category === 'FORECLOSURE').length
      }
    };
    
    res.json({
      summary,
      loans: analyzedLoans
    });
    
  } catch (error) {
    console.error('Error fetching sample loans:', error);
    res.status(500).json({ error: 'Failed to fetch sample loans' });
  }
});

export default router;