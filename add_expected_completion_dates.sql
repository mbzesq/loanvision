-- Migration: Add expected completion date columns to foreclosure tables
-- Date: 2025-01-22
-- Purpose: Store calculated expected completion dates for each foreclosure milestone

-- Add expected completion date columns to the current foreclosure events table
ALTER TABLE foreclosure_events
ADD COLUMN referral_expected_completion_date DATE,
ADD COLUMN title_ordered_expected_completion_date DATE,
ADD COLUMN title_received_expected_completion_date DATE,
ADD COLUMN complaint_filed_expected_completion_date DATE,
ADD COLUMN service_completed_expected_completion_date DATE,
ADD COLUMN judgment_expected_completion_date DATE,
ADD COLUMN sale_scheduled_expected_completion_date DATE,
ADD COLUMN sale_held_expected_completion_date DATE,
ADD COLUMN real_estate_owned_expected_completion_date DATE,
ADD COLUMN eviction_completed_expected_completion_date DATE;

-- Add expected completion date columns to the history table for consistency
ALTER TABLE foreclosure_events_history
ADD COLUMN referral_expected_completion_date DATE,
ADD COLUMN title_ordered_expected_completion_date DATE,
ADD COLUMN title_received_expected_completion_date DATE,
ADD COLUMN complaint_filed_expected_completion_date DATE,
ADD COLUMN service_completed_expected_completion_date DATE,
ADD COLUMN judgment_expected_completion_date DATE,
ADD COLUMN sale_scheduled_expected_completion_date DATE,
ADD COLUMN sale_held_expected_completion_date DATE,
ADD COLUMN real_estate_owned_expected_completion_date DATE,
ADD COLUMN eviction_completed_expected_completion_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN foreclosure_events.referral_expected_completion_date IS 'Expected completion date for referral milestone based on state benchmarks';
COMMENT ON COLUMN foreclosure_events.title_ordered_expected_completion_date IS 'Expected completion date for title ordered milestone based on state benchmarks';
COMMENT ON COLUMN foreclosure_events.title_received_expected_completion_date IS 'Expected completion date for title received milestone based on state benchmarks';
COMMENT ON COLUMN foreclosure_events.complaint_filed_expected_completion_date IS 'Expected completion date for complaint filed milestone based on state benchmarks';
COMMENT ON COLUMN foreclosure_events.service_completed_expected_completion_date IS 'Expected completion date for service completed milestone based on state benchmarks';
COMMENT ON COLUMN foreclosure_events.judgment_expected_completion_date IS 'Expected completion date for judgment milestone based on state benchmarks';
COMMENT ON COLUMN foreclosure_events.sale_scheduled_expected_completion_date IS 'Expected completion date for sale scheduled milestone based on state benchmarks';
COMMENT ON COLUMN foreclosure_events.sale_held_expected_completion_date IS 'Expected completion date for sale held milestone based on state benchmarks';
COMMENT ON COLUMN foreclosure_events.real_estate_owned_expected_completion_date IS 'Expected completion date for REO milestone based on state benchmarks';
COMMENT ON COLUMN foreclosure_events.eviction_completed_expected_completion_date IS 'Expected completion date for eviction completed milestone based on state benchmarks';