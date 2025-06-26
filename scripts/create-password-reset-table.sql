-- Create password reset OTP table
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires ON password_reset_otps(expires_at);

-- Add RLS policies
ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Policy to allow inserting OTP records
CREATE POLICY "Allow inserting OTP records" ON password_reset_otps
    FOR INSERT WITH CHECK (true);

-- Policy to allow reading OTP records for verification
CREATE POLICY "Allow reading OTP records for verification" ON password_reset_otps
    FOR SELECT USING (true);

-- Policy to allow deleting used OTP records
CREATE POLICY "Allow deleting used OTP records" ON password_reset_otps
    FOR DELETE USING (true); 