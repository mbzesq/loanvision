-- Create beta_requests table for landing page beta access requests
CREATE TABLE IF NOT EXISTS beta_requests (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  company VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  portfolio_size VARCHAR(50) NOT NULL,
  additional_info TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50) DEFAULT 'landing_page',
  status VARCHAR(50) DEFAULT 'pending',
  followed_up_at TIMESTAMP NULL,
  priority_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_beta_requests_email ON beta_requests(email);

-- Create index on status for admin filtering
CREATE INDEX IF NOT EXISTS idx_beta_requests_status ON beta_requests(status);

-- Create index on priority_score for sorting
CREATE INDEX IF NOT EXISTS idx_beta_requests_priority ON beta_requests(priority_score DESC);

-- Add comments for documentation
COMMENT ON TABLE beta_requests IS 'Stores beta access requests from the public landing page';
COMMENT ON COLUMN beta_requests.portfolio_size IS 'Options: under-25m, 25m-100m, 100m-500m, 500m-1b, 1b-5b, over-5b';
COMMENT ON COLUMN beta_requests.status IS 'Options: pending, approved, rejected, contacted';
COMMENT ON COLUMN beta_requests.priority_score IS 'Calculated based on portfolio size: over-5b=100, 1b-5b=90, etc.';
COMMENT ON COLUMN beta_requests.source IS 'Source of the request: landing_page, referral, etc.';