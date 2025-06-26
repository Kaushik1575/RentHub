-- Add columns for rejection tracking
ALTER TABLE bookings
ADD COLUMN rejection_reason text,
ADD COLUMN rejection_timestamp timestamp with time zone,
ADD COLUMN refund_amount decimal(10,2),
ADD COLUMN refund_status text,
ADD COLUMN refund_timestamp timestamp with time zone;

-- Add a check constraint on refund_status
ALTER TABLE bookings
ADD CONSTRAINT valid_refund_status 
CHECK (refund_status IN ('processing', 'completed', NULL));

-- Add a check constraint on status to include rejected
ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE bookings
ADD CONSTRAINT valid_status 
CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rejected', 'completed'));

-- Add missing columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmation_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2);

-- Update the status type if needed
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'rejected', 'cancelled');
    END IF;
END $$;

-- Update existing status column to use the enum
ALTER TABLE bookings ALTER COLUMN status TYPE booking_status USING status::booking_status; 