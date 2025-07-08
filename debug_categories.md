# Loan Categorization QC Analysis

## Issue: 111 loans in "Securitizable" seems high

### Potential Problems:

1. **Fallback Logic Too Generous**
   - Current: 30% of loans without payment data → Securitizable
   - If 370 loans have no payment data: 30% × 370 = 111 loans
   - **This matches your observation!**

2. **Payment Data Quality**
   - Check: Are monthly payment fields mostly null/empty?
   - Check: Are loans inappropriately getting 12+ consecutive payments?

3. **Consecutive Payment Logic**
   - Issue: Might be counting null/0 as "no payment" incorrectly
   - Issue: Might be counting across wrong months

## Immediate Diagnostic Steps:

1. **Check Browser Console** for debug logs showing:
   - How many loans have payment data vs fallback
   - Sample loan payment histories
   - Consecutive payment counts

2. **Look for Console Output:**
   ```
   [DEBUG] Loan 12345: {
     fc_status: null,
     january_2025: null,
     february_2025: null,
     ...
   }
   ```

3. **Expected Distribution if All Fallback:**
   - Securitizable: 30% = ~273 loans
   - Steady: 20% = ~182 loans  
   - Recent: 10% = ~91 loans
   - Paying: 20% = ~182 loans
   - Non-performing: 10% = ~91 loans
   - Foreclosure: 10% = ~91 loans

## Quick Fix Options:

1. **Reduce Fallback Securitizable %**
   - Change `distribution <= 2` to `distribution <= 0` (10% instead of 30%)

2. **Make Fallback More Realistic**
   - Most NPL portfolios have <10% truly securitizable loans
   - Should be mostly "Paying" or "Non-performing"

3. **Add Payment Data Validation**
   - Check if payment fields are actually populated
   - Log how many loans use real data vs fallback

## Next Steps:
1. Check browser console for debug output
2. Verify payment data quality in database
3. Adjust fallback distribution to be more realistic