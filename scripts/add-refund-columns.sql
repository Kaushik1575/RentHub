-- Add columns for refund details and deduction
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS refund_details JSONB,
ADD COLUMN IF NOT EXISTS refund_deduction DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS cancelled_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refund_completed_by INTEGER REFERENCES users(id);

-- Create activity log table if it doesn't exist
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    booking_id INTEGER REFERENCES bookings(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); 