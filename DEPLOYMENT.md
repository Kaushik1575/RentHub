# RentHub Deployment Guide for Render

## Prerequisites
1. GitHub repository with your RentHub code
2. Supabase project set up
3. Gmail account with App Password

## Step 1: Prepare Your Repository

1. **Push your code to GitHub** (if not already done)
2. **Ensure these files are in your repository:**
   - `server-supabase.js` (main server file)
   - `package.json` (with all dependencies)
   - `render.yaml` (deployment configuration)
   - `public/` folder (all frontend files)

## Step 2: Deploy to Render

1. **Go to [Render Dashboard](https://dashboard.render.com)**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**
   - **Name:** `renthub` (or your preferred name)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server-supabase.js`
   - **Plan:** Free (or paid if needed)

## Step 3: Set Environment Variables

In your Render service dashboard, go to **Environment** tab and add these variables:

### Required Variables:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_secure_jwt_secret
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
NODE_ENV=production
```

### How to get these values:

#### Supabase Variables:
1. Go to your Supabase project dashboard
2. Settings → API
3. Copy the Project URL and anon key
4. For service role key, go to Settings → API → Project API keys

#### Gmail App Password:
1. Go to your Google Account settings
2. Security → 2-Step Verification (enable if not)
3. Security → App passwords
4. Generate a new app password for "Mail"
5. Use this password (not your regular Gmail password)

#### JWT Secret:
Generate a secure random string (you can use an online generator)

## Step 4: Deploy and Test

1. **Click "Create Web Service"**
2. **Wait for deployment to complete** (usually 2-5 minutes)
3. **Your app will be available at:** `https://your-app-name.onrender.com`

## Step 5: Test Email Service

After deployment, test the email functionality:

### Test 1: Password Reset OTP
1. Go to your deployed app
2. Click "Login" → "Forgot Password?"
3. Enter your email address
4. Check if you receive the OTP email

### Test 2: Booking Confirmation
1. Create a test booking
2. Login as admin and confirm the booking
3. Check if the user receives confirmation email

### Test 3: Refund Completion
1. Cancel a booking
2. Login as admin and mark refund as complete
3. Check if the user receives refund completion email

## Troubleshooting Email Issues

### If emails are not working:

1. **Check Gmail App Password:**
   - Ensure you're using App Password, not regular password
   - Verify 2-Step Verification is enabled

2. **Check Environment Variables:**
   - Verify EMAIL_USER and EMAIL_PASS are set correctly
   - Check for any typos

3. **Check Render Logs:**
   - Go to your Render service → Logs
   - Look for email-related error messages

4. **Test Email Configuration:**
   ```javascript
   // Add this to your server temporarily for testing
   const { sendPasswordResetOTP } = require('./config/emailService');
   
   app.get('/test-email', async (req, res) => {
       try {
           const result = await sendPasswordResetOTP('your-email@example.com', 'Test User', '123456');
           res.json(result);
       } catch (error) {
           res.json({ error: error.message });
       }
   });
   ```

### Common Issues:

1. **"Invalid login" error:** Wrong Gmail app password
2. **"Username and Password not accepted":** Using regular password instead of app password
3. **Emails going to spam:** Normal for new email addresses, check spam folder

## Security Notes

1. **Never commit `.env` files** to your repository
2. **Use strong JWT secrets** in production
3. **Enable HTTPS** (Render provides this automatically)
4. **Regularly update dependencies**

## Monitoring

- **Check Render logs** regularly for errors
- **Monitor email delivery** rates
- **Set up alerts** for service downtime

## Support

If you encounter issues:
1. Check Render logs first
2. Verify all environment variables
3. Test email configuration locally
4. Check Supabase connection

Your RentHub application should now be live with full email functionality! 