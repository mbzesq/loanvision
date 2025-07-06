-- Add unique constraint on loan_id for upsert operations
ALTER TABLE loan_sol_calculations
ADD CONSTRAINT loan_sol_calculations_loan_id_unique UNIQUE (loan_id);