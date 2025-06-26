# Email Notification System Setup

This guide will help you set up email notifications for booking confirmations and password reset functionality.

## Features Added

1. **Booking Confirmation Emails**: When an admin confirms a booking, the user receives a detailed email notification
2. **Forgot Password with OTP**: Users can reset their password using email OTP verification

## Setup Instructions

### 1. Install Dependencies

The required dependencies have already been installed:
```bash
npm install nodemailer
```

### 2. Set Up Gmail for Sending Emails

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to [Google Account settings](https://myaccount.google.com/)
   - Navigate to Security > 2-Step Verification > App passwords
   - Generate a new app password for "Mail"
   - Copy this password (you'll need it for the configuration)

### 3. Configure Email Settings

1. **Copy the example configuration file**:
   ```bash
   cp config/email-config.example.js config/email-config.js
   ```

2. **Update the configuration** in `config/email-config.js`:
   ```javascript
   module.exports = {
       emailUser: 'your-actual-email@gmail.com',  // Your Gmail address
       emailPass: 'your-app-password',            // The app password you generated
       frontendUrl: 'http://localhost:3005'       // Your frontend URL
   };
   ```

3. **Add the config file to .gitignore** to keep your credentials secure:
   ```bash
   echo "config/email-config.js" >> .gitignore
   ```

### 4. Create Database Table

Run the SQL script to create the password reset OTP table:

```sql
-- Execute this in your Supabase SQL editor
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires ON password_reset_otps(expires_at);

-- Enable RLS and add policies
ALTER TABLE password_reset_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow inserting OTP records" ON password_reset_otps
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow reading OTP records for verification" ON password_reset_otps
    FOR SELECT USING (true);

CREATE POLICY "Allow deleting used OTP records" ON password_reset_otps
    FOR DELETE USING (true);
```

### 5. Test the Setup

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Test booking confirmation emails**:
   - Create a booking as a user
   - Login as admin and confirm the booking
   - Check if the user receives an email notification

3. **Test forgot password**:
   - Go to the login page
   - Click "Forgot Password?"
   - Enter your email and follow the OTP verification process

## Email Templates

### Booking Confirmation Email
- Beautiful HTML template with booking details
- Includes vehicle information, dates, times, and amounts
- Professional styling with RentHub branding

### Password Reset OTP Email
- Clean design with security warnings
- 6-digit OTP prominently displayed
- 10-minute expiration notice

## Troubleshooting

### Common Issues

1. **"Authentication failed" error**:
   - Make sure you're using an App Password, not your regular Gmail password
   - Ensure 2-Factor Authentication is enabled on your Gmail account

2. **"User not found" error**:
   - Check if the user exists in the database
   - Verify the email address is correct

3. **OTP not working**:
   - Check if the `password_reset_otps` table was created correctly
   - Verify the OTP hasn't expired (10 minutes)

4. **Emails not sending**:
   - Check your Gmail account for any security alerts
   - Verify the email configuration in `config/email-config.js`
   - Check server logs for detailed error messages

### Security Notes

- Never commit your `email-config.js` file to version control
- Use environment variables in production
- Regularly rotate your Gmail app passwords
- Monitor email sending logs for any suspicious activity

## API Endpoints

### New Endpoints Added

1. **POST /api/forgot-password**
   - Request body: `{ "email": "user@example.com" }`
   - Sends OTP to user's email

2. **POST /api/reset-password**
   - Request body: `{ "email": "user@example.com", "otp": "123456", "newPassword": "newpass" }`
   - Verifies OTP and updates password

### Modified Endpoints

1. **POST /api/admin/bookings/:id/confirm**
   - Now sends email notification when booking is confirmed
   - Includes detailed booking information in the email

## Files Modified/Created

### New Files
- `config/emailService.js` - Email service module
- `config/email-config.example.js` - Email configuration template
- `public/forgot-password.html` - Forgot password page
- `scripts/create-password-reset-table.sql` - Database setup script
- `EMAIL_SETUP.md` - This setup guide

### Modified Files
- `server-supabase.js` - Added email notifications and forgot password endpoints
- `public/login.html` - Added "Forgot Password" link
- `package.json` - Added nodemailer dependency

## Production Deployment

For production deployment:

1. Use environment variables instead of config files
2. Set up proper email service (Gmail, SendGrid, etc.)
3. Configure proper CORS settings
4. Set up monitoring for email delivery
5. Implement rate limiting for OTP requests
6. Add proper error handling and logging 