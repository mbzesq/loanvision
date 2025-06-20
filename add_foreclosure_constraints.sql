-- Add unique constraint for ON CONFLICT to work
ALTER TABLE foreclosure_milestone_statuses 
ADD CONSTRAINT unique_loan_milestone 
UNIQUE (loan_id, milestone_name);