const nodemailer = require('nodemailer');

// Try to load email config, fallback to environment variables
let emailConfig;
try {
    emailConfig = require('./email-config.js');
} catch (error) {
    console.log('Email config file not found, using environment variables');
    emailConfig = {
        emailUser: process.env.EMAIL_USER || 'your-email@gmail.com',
        emailPass: process.env.EMAIL_PASS || 'your-app-password',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3005'
    };
}

// Email configuration
const transporterConfig = {
    service: 'gmail',
    auth: {
        user: emailConfig.emailUser,
        pass: emailConfig.emailPass
    }
};

// Create transporter
const transporter = nodemailer.createTransport(transporterConfig);

// Generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send booking confirmation email
async function sendBookingConfirmationEmail(userEmail, userName, bookingDetails) {
    try {
        const mailOptions = {
            from: '"RentHub Booking" <' + transporterConfig.auth.user + '>',
            to: userEmail,
            subject: 'Your Booking is Confirmed! - RentHub',
            html: `
                <div style="font-family: Arial, sans-serif; color: #222;">
                  <h2>Hello${userName ? ', ' + userName : ''}!</h2>
                  <p>We are excited to let you know that your booking has been <b>confirmed</b> by the RentHub team.</p>
                  <h3>Booking Details:</h3>
                  <ul>
                    <li><b>Vehicle:</b> ${bookingDetails.vehicleName}</li>
                    <li><b>Type:</b> ${bookingDetails.vehicleType}</li>
                    <li><b>Start Date:</b> ${bookingDetails.startDate}</li>
                    <li><b>Start Time:</b> ${bookingDetails.startTime}</li>
                    <li><b>Duration:</b> ${bookingDetails.duration} hours</li>
                    <li><b>Total Amount:</b> ₹${bookingDetails.totalAmount}</li>
                    <li><b>Advance Payment:</b> ₹${bookingDetails.advancePayment}</li>
                    <li><b>Remaining Amount:</b> ₹${bookingDetails.remainingAmount}</li>
                    <li><b>Confirmation Time:</b> ${bookingDetails.confirmationTime}</li>
                  </ul>
                  <p>Please ensure you have the remaining amount ready for payment at the time of pickup.</p>
                  <p>If you have any questions or need to make changes, please contact us immediately.</p>
                  <br>
                  <p>Thank you for choosing RentHub!<br>The RentHub Team</p>
                  <hr>
                  <small>If you find this email in your spam folder, please mark it as 'Not Spam' to help us deliver future emails to your inbox.</small>
                </div>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Booking confirmation email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('Error sending booking confirmation email:', error);
        return { success: false, error: error.message };
    }
}

// Send password reset OTP email
async function sendPasswordResetOTP(userEmail, userName, otp) {
    try {
        const mailOptions = {
            from: '"RentHub OTP" <' + transporterConfig.auth.user + '>',
            to: userEmail,
            subject: 'Your RentHub OTP Code',
            html: `
                <div style="font-family: Arial, sans-serif; color: #222;">
                  <h2>Hello${userName ? ', ' + userName : ''}!</h2>
                  <p>You requested a password reset for your RentHub account.</p>
                  <p><b>Your OTP code is:</b> <span style="font-size: 1.5em; color: #1976d2;">${otp}</span></p>
                  <p>This code will expire in 10 minutes.</p>
                  <p>If you did not request this, you can safely ignore this email.</p>
                  <br>
                  <p>Thank you,<br>The RentHub Team</p>
                  <hr>
                  <small>If you find this email in your spam folder, please mark it as 'Not Spam' to help us deliver future emails to your inbox.</small>
                </div>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Password reset OTP email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('Error sending password reset OTP email:', error);
        return { success: false, error: error.message };
    }
}

// Send refund completion email
async function sendRefundCompleteEmail(userEmail, userName, bookingId, amount, refundTime, refundDetails) {
    try {
        const detailsString = refundDetails
            ? (typeof refundDetails === 'string'
                ? refundDetails
                : (refundDetails.method === 'upi'
                    ? `UPI: ${refundDetails.upiId || ''}`
                    : refundDetails.method === 'bank'
                        ? `Bank Account: ${refundDetails.accountHolder || ''} (${refundDetails.accountNumber || ''}), IFSC: ${refundDetails.ifsc || ''}`
                        : JSON.stringify(refundDetails)))
            : 'N/A';
        const mailOptions = {
            from: '"RentHub Refund" <' + transporterConfig.auth.user + '>',
            to: userEmail,
            subject: 'Your RentHub Refund is Complete',
            html: `
                <div style="font-family: Arial, sans-serif; color: #222;">
                  <h2>Hello${userName ? ', ' + userName : ''}!</h2>
                  <p>We're happy to let you know that your refund for booking #${bookingId} has been <b>successfully credited</b> to your provided details.</p>
                  <ul>
                    <li><b>Refund Amount:</b> ₹${amount}</li>
                    <li><b>Refund Date:</b> ${refundTime}</li>
                    <li><b>Refund Details:</b> ${detailsString}</li>
                  </ul>
                  <p>If you have any questions, please reply to this email or contact our support team.</p>
                  <br>
                  <p>Thank you for using RentHub!<br>The RentHub Team</p>
                  <hr>
                  <small>If you find this email in your spam folder, please mark it as 'Not Spam' to help us deliver future emails to your inbox.</small>
                </div>
            `
        };
        const result = await transporter.sendMail(mailOptions);
        console.log('Refund completion email sent successfully:', result.messageId);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('Error sending refund completion email:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    generateOTP,
    sendBookingConfirmationEmail,
    sendPasswordResetOTP,
    sendRefundCompleteEmail
}; 