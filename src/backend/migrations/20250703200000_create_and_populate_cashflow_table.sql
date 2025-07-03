-- Step 1: Create the new normalized table for cashflow data
CREATE TABLE monthly_cashflow_data (
  id SERIAL PRIMARY KEY,
  loan_id VARCHAR(255) NOT NULL,
  payment_date DATE NOT NULL,
  payment_amount NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Perform a one-time data migration from the old "wide" table to the new "tall" table for the year 2025
INSERT INTO monthly_cashflow_data (loan_id, payment_date, payment_amount)
SELECT
  loan_id,
  (DATE_TRUNC('year', '2025-01-01'::date) + (month_series.month_num - 1) * INTERVAL '1 month')::date as payment_date,
  payment_amount
FROM daily_metrics_current,
LATERAL (
  VALUES
    (1, january_2025), (2, february_2025), (3, march_2025),
    (4, april_2025),   (5, may_2025),      (6, june_2025),
    (7, july_2025),    (8, august_2025),   (9, september_2025),
    (10, october_2025),(11, november_2025),(12, december_2025)
) AS month_series(month_num, payment_amount)
WHERE month_series.payment_amount IS NOT NULL AND month_series.payment_amount > 0;

-- Step 3: Create an index for faster queries
CREATE INDEX idx_monthly_cashflow_data_loan_id_date ON monthly_cashflow_data (loan_id, payment_date);