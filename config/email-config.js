// Email Configuration Example
// Copy this file to email-config.js and update with your actual email credentials

module.exports = {
    emailUser: 'renthub.otp@gmail.com',      // The Gmail you used to generate the app password
    emailPass: 'hgjfcdoorkonomcf',           // The 16-character app password, NO SPACES
    frontendUrl: 'http://localhost:3005'
};

/*
To set up Gmail for sending emails:

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security > 2-Step Verification > App passwords
   - Generate a new app password for "Mail"
   - Use this password in EMAIL_PASS

3. Update the email-config.js file with your actual credentials

4. Make sure to add email-config.js to .gitignore to keep your credentials secure
*/ 