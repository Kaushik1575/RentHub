const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SupabaseDB = require('./models/supabaseDB');
const supabase = require('./config/supabase');
const { sendBookingConfirmationEmail, sendPasswordResetOTP, generateOTP } = require('./config/emailService');

const app = express();
const PORT = process.env.PORT || 3005;
const JWT_SECRET = 'your-secret-key'; // Use the same secret key as server-new.js
const ADMIN_EMAILS = ['jyoti2006@gmail.com']; // <-- Replace with your actual admin email

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to verify user token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Invalid token format' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Use the consistent secret key
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Admin middleware
const verifyAdminToken = async (req, res, next) => {
    console.log('verifyAdminToken called');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('No token provided');
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Decoded token:', decoded);
        const { data: user, error } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', decoded.id)
            .single();
        console.log('User from DB:', user, 'Error:', error);
        if (error || !user || !user.is_admin) {
            console.log('Not authorized as admin');
            return res.status(403).json({ message: 'Not authorized as admin' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        console.log('Invalid token:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Helper function to get IST time in 'YYYY-MM-DD HH:mm:ss' format
function getISTTimestamp() {
    const now = new Date();
    // Convert to IST (UTC+5:30) using toLocaleString with Asia/Kolkata
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    return istTime.getFullYear() + '-' +
        String(istTime.getMonth() + 1).padStart(2, '0') + '-' +
        String(istTime.getDate()).padStart(2, '0') + ' ' +
        String(istTime.getHours()).padStart(2, '0') + ':' +
        String(istTime.getMinutes()).padStart(2, '0') + ':' +
        String(istTime.getSeconds()).padStart(2, '0');
}

// Admin: Get all bookings (enriched)
app.get('/api/admin/bookings', verifyAdminToken, async (req, res) => {
    try {
        // Get all bookings with user details
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select(`
                *,
                users:user_id (
                    full_name,
                    email,
                    phone_number
                )
            `);
        
        if (error) throw error;

        // Get all vehicles
        const { data: bikes } = await supabase.from('bikes').select('*');
        const { data: cars } = await supabase.from('cars').select('*');
        const { data: scooty } = await supabase.from('scooty').select('*');
        
        const allVehicles = [...(bikes || []), ...(cars || []), ...(scooty || [])];

        // Format the bookings data
        const enrichedBookings = bookings.map(booking => {
            // Find the vehicle
            const vehicle = allVehicles.find(v => v.id === booking.vehicle_id);
            
            // Calculate amounts based on vehicle price and duration
            const duration = parseInt(booking.duration) || 0;
            const vehiclePrice = vehicle ? parseFloat(vehicle.price) || 0 : 0;
            const totalAmount = duration * vehiclePrice;
            const advancePayment = parseFloat(booking.advance_payment) || 100; // Default advance payment
            const remainingAmount = totalAmount - advancePayment;

            return {
                id: booking.id,
                customerName: booking.users?.full_name || 'N/A',
                customerEmail: booking.users?.email || 'N/A',
                customerPhone: booking.users?.phone_number || 'N/A',
                vehicleName: vehicle ? vehicle.name : 'N/A',
                vehicleType: vehicle ? vehicle.type : booking.vehicle_type || 'N/A',
                vehicleCategory: vehicle ? vehicle.category : booking.vehicle_category || 'N/A',
                start_date: booking.start_date || 'N/A',
                start_time: booking.start_time || 'N/A',
                duration: duration,
                total_amount: totalAmount,
                advance_payment: advancePayment,
                remaining_amount: remainingAmount,
                status: booking.status || 'pending',
                refund_amount: parseFloat(booking.refund_amount) || 0,
                refund_status: booking.refund_status || 'N/A',
                refund_timestamp: booking.refund_timestamp || null,
                refund_details: booking.refund_details || null,
                refund_deduction: booking.refund_deduction !== undefined && booking.refund_deduction !== null ? parseFloat(booking.refund_deduction) : 0,
                created_at: booking.created_at || null,
                confirmation_timestamp: booking.confirmation_timestamp || null,
                cancelled_timestamp: booking.cancelled_timestamp || null,
                transaction_id: booking.transaction_id || 'N/A'
            };
        });

        res.json(enrichedBookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Error fetching bookings' });
    }
});

// Get a single booking by ID (admin)
app.get('/api/admin/bookings/:id', verifyAdminToken, async (req, res) => {
    try {
        const { data: booking, error } = await supabase
            .from('bookings')
            .select(`
                *,
                users:user_id (
                    full_name,
                    email,
                    phone_number
                )
            `)
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!booking) {
            console.log('Booking not found for ID:', req.params.id);
            return res.status(404).json({ error: 'Booking not found' });
        }

        console.log('Fetched booking:', booking);

        // Get vehicle details
        let vehicle;
        if (booking.vehicle_type === 'bike') {
            const { data } = await supabase.from('bikes').select('*').eq('id', booking.vehicle_id).single();
            vehicle = data;
        } else if (booking.vehicle_type === 'car') {
            const { data } = await supabase.from('cars').select('*').eq('id', booking.vehicle_id).single();
            vehicle = data;
        } else if (booking.vehicle_type === 'scooty') {
            const { data } = await supabase.from('scooty').select('*').eq('id', booking.vehicle_id).single();
            vehicle = data;
        }

        console.log('Vehicle lookup result:', vehicle);
        console.log('User lookup result:', booking.users);

        // Calculate amounts based on vehicle price and duration
        const duration = parseInt(booking.duration) || 0;
        const vehiclePrice = vehicle ? parseFloat(vehicle.price) || 0 : 0;
        const totalAmount = duration * vehiclePrice;
        const advancePayment = parseFloat(booking.advance_payment) || 100; // Default advance payment
        const remainingAmount = totalAmount - advancePayment;

        const enrichedBooking = {
            id: booking.id,
            customerName: booking.users?.full_name || 'N/A',
            customerEmail: booking.users?.email || 'N/A',
            customerPhone: booking.users?.phone_number || 'N/A',
            vehicleName: vehicle ? vehicle.name : 'N/A',
            vehicleType: vehicle ? vehicle.type : booking.vehicle_type || 'N/A',
            vehicleCategory: vehicle ? vehicle.category : booking.vehicle_category || 'N/A',
            start_date: booking.start_date || 'N/A',
            start_time: booking.start_time || 'N/A',
            duration: duration,
            total_amount: totalAmount,
            advance_payment: advancePayment,
            remaining_amount: remainingAmount,
            status: booking.status || 'pending',
            refund_amount: parseFloat(booking.refund_amount) || 0,
            refund_status: booking.refund_status || 'N/A',
            refund_timestamp: booking.refund_timestamp || null,
            refund_details: booking.refund_details || null,
            refund_deduction: booking.refund_deduction !== undefined && booking.refund_deduction !== null ? parseFloat(booking.refund_deduction) : 0,
            created_at: booking.created_at || null,
            confirmation_timestamp: booking.confirmation_timestamp || null,
            cancelled_timestamp: booking.cancelled_timestamp || null,
            transaction_id: booking.transaction_id || 'N/A'
        };

        res.json(enrichedBooking);
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ error: 'Error fetching booking' });
    }
});

// Admin: Delete booking
app.delete('/api/admin/bookings/:id', verifyAdminToken, async (req, res) => {
    try {
        const { error } = await supabase.from('bookings').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: 'Booking deleted successfully' });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Error deleting booking' });
    }
});

// Admin: Update booking
app.put('/api/admin/bookings/:id', verifyAdminToken, async (req, res) => {
    try {
        const { startDate, startTime, duration, status, totalAmount, advancePayment, remainingAmount } = req.body;
        const { data, error } = await supabase
            .from('bookings')
            .update({
                start_date: startDate,
                start_time: startTime,
                duration: duration,
                status: status,
                total_amount: totalAmount,
                advance_payment: advancePayment,
                remaining_amount: remainingAmount,
                updated_at: new Date().toISOString()
            })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ error: 'Error updating booking' });
    }
});

// Admin: Confirm booking
app.post('/api/admin/bookings/:id/confirm', verifyAdminToken, async (req, res) => {
    try {
        const bookingId = req.params.id;
        console.log('Confirming booking with ID:', bookingId);

        // First, fetch the booking with user and vehicle details
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select(`
                *,
                users:user_id (
                    email,
                    full_name,
                    phone_number
                )
            `)
            .eq('id', bookingId)
            .single();

        if (fetchError) {
            console.error('Error fetching booking:', fetchError);
            return res.status(500).json({ error: 'Error fetching booking details' });
        }

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Get vehicle details
        let vehicle;
        if (booking.vehicle_type === 'bike') {
            const { data } = await supabase.from('bikes').select('*').eq('id', booking.vehicle_id).single();
            vehicle = data;
        } else if (booking.vehicle_type === 'car') {
            const { data } = await supabase.from('cars').select('*').eq('id', booking.vehicle_id).single();
            vehicle = data;
        } else if (booking.vehicle_type === 'scooty') {
            const { data } = await supabase.from('scooty').select('*').eq('id', booking.vehicle_id).single();
            vehicle = data;
        }

        // Always set confirmation_timestamp to current IST time
        const istTimestamp = getISTTimestamp();
        console.log('Setting confirmation_timestamp to (IST):', istTimestamp); // Debug log
        const { data: updatedBooking, error: updateError } = await supabase
            .from('bookings')
            .update({
                status: 'confirmed',
                confirmation_timestamp: istTimestamp,
                updated_at: istTimestamp
            })
            .eq('id', bookingId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating booking:', updateError);
            return res.status(500).json({ error: 'Error updating booking status' });
        }

        // Send email notification
        if (booking.users?.email && booking.users?.full_name) {
            try {
                const duration = parseInt(booking.duration) || 0;
                const vehiclePrice = vehicle ? parseFloat(vehicle.price) || 0 : 0;
                const totalAmount = duration * vehiclePrice;
                const advancePayment = parseFloat(booking.advance_payment) || 100;
                const remainingAmount = totalAmount - advancePayment;

                const bookingDetails = {
                    vehicleName: vehicle ? vehicle.name : 'N/A',
                    vehicleType: vehicle ? vehicle.type : booking.vehicle_type || 'N/A',
                    startDate: booking.start_date || 'N/A',
                    startTime: booking.start_time || 'N/A',
                    duration: duration,
                    totalAmount: totalAmount,
                    advancePayment: advancePayment,
                    remainingAmount: remainingAmount,
                    confirmationTime: istTimestamp
                };

                const emailResult = await sendBookingConfirmationEmail(
                    booking.users.email,
                    booking.users.full_name,
                    bookingDetails
                );

                if (emailResult.success) {
                    console.log('Booking confirmation email sent successfully');
                } else {
                    console.error('Failed to send booking confirmation email:', emailResult.error);
                }
            } catch (emailError) {
                console.error('Error sending booking confirmation email:', emailError);
                // Don't fail the booking confirmation if email fails
            }
        }

        res.json(updatedBooking);
    } catch (error) {
        console.error('Error confirming booking:', error);
        res.status(500).json({ error: 'Error confirming booking' });
    }
});

// Admin: Reject booking
app.post('/api/admin/bookings/:id/reject', verifyAdminToken, async (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        
        // First, fetch the booking without joins
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select(`
                id,
                user_id,
                vehicle_id,
                vehicle_type,
                start_date,
                start_time,
                duration,
                status,
                created_at,
                transaction_id
            `)
            .eq('id', bookingId)
            .single();

        if (fetchError) {
            console.error('Error fetching booking:', fetchError);
            return res.status(500).json({ error: 'Error fetching booking details' });
        }

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending bookings can be rejected' });
        }

        // Get the reason from the request body
        const reason = req.body && req.body.reason ? req.body.reason : null;
        const now = new Date();
        const localTimestamp = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');
        // Update booking status to rejected and save the reason, timestamps, and refund info
        const { error: updateError } = await supabase
            .from('bookings')
            .update({ 
                status: 'rejected',
                rejection_reason: reason,
                refund_status: 'processing',
                rejection_timestamp: localTimestamp,
                refund_deduction: 0
            })
            .eq('id', bookingId);

        if (updateError) {
            console.error('Error updating booking:', updateError);
            return res.status(500).json({ error: 'Error updating booking status' });
        }

        // If the booking has a vehicle, update its availability
        if (booking.vehicle_id && booking.vehicle_type) {
            let vehicleTable = booking.vehicle_type;
            if (vehicleTable === 'car') vehicleTable = 'cars';
            if (vehicleTable === 'bike') vehicleTable = 'bikes';
            
            const { error: vehicleError } = await supabase
                .from(vehicleTable)
                .update({ is_available: true })
                .eq('id', booking.vehicle_id);

            if (vehicleError) {
                console.error('Error updating vehicle availability:', vehicleError);
            }
        }

        // Fetch user details separately
        let userData = null;
        if (booking.user_id) {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('email, full_name, phone_number')
                .eq('id', booking.user_id)
                .single();
                
            if (!userError) {
                userData = user;
            }
        }

        // Fetch vehicle details separately
        let vehicleData = null;
        if (booking.vehicle_id && booking.vehicle_type) {
            let vehicleTable = booking.vehicle_type;
            if (vehicleTable === 'car') vehicleTable = 'cars';
            if (vehicleTable === 'bike') vehicleTable = 'bikes';
            
            const { data: vehicle, error: vehicleError } = await supabase
                .from(vehicleTable)
                .select('*')
                .eq('id', booking.vehicle_id)
                .single();
                
            if (!vehicleError) {
                vehicleData = vehicle;
            }
        }

        res.json({
            message: 'Booking rejected successfully',
            booking: {
                ...booking,
                user: userData,
                vehicle: vehicleData
            }
        });
    } catch (error) {
        console.error('Error in reject booking endpoint:', error);
        res.status(500).json({
            error: 'Error rejecting booking',
            details: error.message
        });
    }
});

// Admin: Mark refund as completed
app.post('/api/admin/bookings/:id/refund-complete', verifyAdminToken, async (req, res) => {
    console.log('Received request to mark refund as complete for booking:', req.params.id);
    try {
        const bookingId = parseInt(req.params.id);
        const adminId = req.user.id;

        // Verify admin status
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', adminId)
            .single();

        if (adminError || !admin || !admin.is_admin) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        // Update the booking refund status with IST timestamp
        const { data: booking, error: updateError } = await supabase
            .from('bookings')
            .update({
                refund_status: 'completed',
                refund_timestamp: getISTTimestamp(),
                refund_completed_by: adminId
            })
            .eq('id', bookingId)
            .select('*, users:user_id(email, full_name)')
            .single();

        if (updateError) {
            console.error('Error updating refund status:', updateError);
            return res.status(500).json({ error: 'Failed to update refund status' });
        }

        // Log the refund completion
        await supabase
            .from('activity_log')
            .insert({
                admin_id: adminId,
                action: 'refund_completed',
                booking_id: bookingId,
                details: {
                    refund_amount: booking.refund_amount,
                    payment_method: booking.refund_details?.method || 'unknown'
                }
            });

        // Send refund completion email to user
        if (booking.users?.email) {
            const { sendRefundCompleteEmail } = require('./config/emailService');
            await sendRefundCompleteEmail(
                booking.users.email,
                booking.users.full_name,
                booking.id,
                booking.refund_amount,
                booking.refund_timestamp,
                booking.refund_details
            );
        }

        res.json({ message: 'Refund marked as completed', booking });
    } catch (error) {
        console.error('Error completing refund:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Cancel booking
app.post('/api/admin/bookings/:id/cancel', verifyAdminToken, async (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        console.log('Processing booking cancellation for ID:', bookingId);
        
        // First, fetch the booking
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('*, users:user_id(*)')
            .eq('id', bookingId)
            .single();

        if (fetchError) {
            console.error('Error fetching booking:', fetchError);
            return res.status(500).json({ error: 'Error fetching booking details' });
        }

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (booking.status !== 'confirmed') {
            return res.status(400).json({ error: 'Only confirmed bookings can be cancelled' });
        }

        // Calculate refund amount based on time since confirmation
        const now = new Date();
        const confirmationTime = booking.confirmation_timestamp ? new Date(booking.confirmation_timestamp) : now;
        const hoursSinceConfirmation = (now - confirmationTime) / (1000 * 60 * 60);
        
        console.log('Booking cancellation debug:', {
            confirmation_timestamp: booking.confirmation_timestamp,
            now: new Date().toISOString(),
            advance_payment: booking.advance_payment
        });

        let refundAmount = 0;
        // Calculate refund based on advance payment only
        const advancePayment = parseFloat(booking.advance_payment) || 100; // Default to 100 if not set
        if (hoursSinceConfirmation <= 2) {
            // Full refund of advance payment
            refundAmount = advancePayment;
        } else {
            // 70% refund of advance payment
            refundAmount = Math.round(advancePayment * 0.7);
        }

        console.log('hoursSinceConfirmation:', hoursSinceConfirmation);

        // Calculate deduction
        let deductionAmount = 0;
        if (hoursSinceConfirmation > 2) {
            deductionAmount = Math.round(advancePayment * 0.3);
        }
        // Use local time for cancelled_timestamp
        const nowCancel = new Date();
        const localCancelTimestamp = nowCancel.getFullYear() + '-' +
            String(nowCancel.getMonth() + 1).padStart(2, '0') + '-' +
            String(nowCancel.getDate()).padStart(2, '0') + ' ' +
            String(nowCancel.getHours()).padStart(2, '0') + ':' +
            String(nowCancel.getMinutes()).padStart(2, '0') + ':' +
            String(nowCancel.getSeconds()).padStart(2, '0');
        // Update booking status to cancelled with refund details, timestamps, and deduction
        const { data: updatedBooking, error: updateError } = await supabase
            .from('bookings')
            .update({ 
                status: 'cancelled',
                refund_amount: refundAmount,
                refund_status: 'processing',
                refund_details: req.body && req.body.refundDetails ? req.body.refundDetails : null,
                cancelled_timestamp: localCancelTimestamp,
                refund_deduction: deductionAmount
            })
            .eq('id', bookingId)
            .select('*, users:user_id(*)')
            .single();

        if (updateError) {
            console.error('Error updating booking:', updateError);
            return res.status(500).json({ error: 'Error updating booking status' });
        }

        // Update vehicle availability back to true
        if (booking.vehicle_id && booking.vehicle_type) {
            let vehicleTable = booking.vehicle_type;
            if (vehicleTable === 'car') vehicleTable = 'cars';
            if (vehicleTable === 'bike') vehicleTable = 'bikes';

            const { error: vehicleError } = await supabase
                .from(vehicleTable)
                .update({ is_available: true })
                .eq('id', booking.vehicle_id);

            if (vehicleError) {
                console.error('Error updating vehicle:', vehicleError);
            }
        }

        console.log('Booking cancelled successfully:', updatedBooking);

        res.json({
            message: 'Booking cancelled successfully',
            refundAmount,
            booking: updatedBooking
        });
    } catch (error) {
        console.error('Error in cancel booking endpoint:', error);
        res.status(500).json({
            error: 'Error cancelling booking',
            details: error.message
        });
    }
});

// Function to check for time-based booking conflicts
async function checkTimeConflict(vehicleId, startDate, startTime, duration) {
    try {
        const { data: existingBookings, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('vehicle_id', vehicleId)
            .eq('start_date', startDate)
            .neq('status', 'cancelled')
            .neq('status', 'rejected');

        if (error) {
            console.error('Supabase error in checkTimeConflict:', error);
            throw error;
        }

        if (!Array.isArray(existingBookings)) {
            console.error('existingBookings is not an array:', existingBookings);
            return { conflict: false };
        }

        // Convert start time to minutes for easier comparison
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const startTimeMinutes = startHour * 60 + startMinute;
        const endTimeMinutes = startTimeMinutes + (duration * 60);
        // Add 1-hour buffer before and after
        const bufferStartTime = startTimeMinutes - 60;
        const bufferEndTime = endTimeMinutes + 60;
        for (const booking of existingBookings) {
            const [existingHour, existingMinute] = booking.startTime.split(':').map(Number);
            const existingStartTimeMinutes = existingHour * 60 + existingMinute;
            const existingEndTimeMinutes = existingStartTimeMinutes + (booking.duration * 60);
            if (existingStartTimeMinutes < bufferEndTime && existingEndTimeMinutes > bufferStartTime) {
                return {
                    conflict: true,
                    existingBooking: booking,
                    message: `Vehicle is already booked from ${booking.startTime} for ${booking.duration} hours. Please choose a different time slot with at least 1 hour gap.`
                };
            }
        }
        return { conflict: false };
    } catch (error) {
        console.error('Error checking time conflict:', error);
        throw error;
    }
}

// User Registration
app.post('/api/register/user', async (req, res) => {
    try {
        const { fullName, email, phoneNumber, password } = req.body;
        
        // Check if user exists
        const existingUser = await SupabaseDB.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            full_name: fullName,
            email,
            phone_number: phoneNumber,
            password: hashedPassword,
            is_admin: false
        };

        await SupabaseDB.createUser(newUser);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Error registering user' });
    }
});

// Admin Registration
app.post('/api/register/admin', async (req, res) => {
    try {
        const { adminName, email, adminId, password, securityCode } = req.body;

        if (securityCode !== '1575') {
            return res.status(403).json({ error: 'Invalid Security Code. You are not authorized to register as admin.' });
        }

        const existingUser = await SupabaseDB.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = {
            admin_name: adminName,
            email,
            admin_id: adminId,
            password: hashedPassword,
            is_admin: true
        };

        await SupabaseDB.createUser(newAdmin);
        res.status(201).json({ message: 'Admin registered successfully' });
    } catch (error) {
        console.error('Error registering admin:', error);
        res.status(500).json({ error: 'Error registering admin' });
    }
});

// Debug endpoint to check user data (remove in production)
app.get('/api/debug/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        console.log('🔍 Debug: Checking user data for email:', email);
        
        const user = await SupabaseDB.getUserByEmail(email);
        console.log('📊 Debug: Raw user data:', user);
        
        if (!user) {
            return res.json({ error: 'User not found', email });
        }
        
        // Show both raw and mapped data
        const mappedUser = {
            id: user.id,
            fullName: user.full_name,
            adminName: user.admin_name,
            email: user.email,
            phoneNumber: user.phone_number,
            isAdmin: user.is_admin || false
        };
        
        res.json({
            raw: user,
            mapped: mappedUser,
            fields: {
                hasFullName: !!user.full_name,
                hasAdminName: !!user.admin_name,
                hasEmail: !!user.email,
                isAdmin: user.is_admin
            }
        });
    } catch (error) {
        console.error('❌ Debug endpoint error:', error);
        res.status(500).json({ error: 'Debug endpoint error', details: error.message });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔍 Login attempt for email:', email);
        
        const user = await SupabaseDB.getUserByEmail(email);
        console.log('📊 Raw user data from Supabase:', user);

        if (!user) {
            console.log('❌ User not found');
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('❌ Invalid password');
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, isAdmin: user.is_admin },
            JWT_SECRET
        );

        // Map snake_case to camelCase for frontend compatibility
        const userResponse = {
            id: user.id,
            fullName: user.full_name,
            adminName: user.admin_name,
            email: user.email,
            phoneNumber: user.phone_number,
            isAdmin: user.is_admin || false
        };
        
        console.log('🎯 Mapped user response:', userResponse);
        console.log('✅ Login successful for:', userResponse.fullName || userResponse.adminName || userResponse.email);

        res.json({ token, user: userResponse });
    } catch (error) {
        console.error('❌ Error during login:', error);
        res.status(500).json({ error: 'Error during login' });
    }
});

// Admin Login
app.post('/api/login/admin', async (req, res) => {
    try {
        const { email, password, adminId } = req.body;
        // Find the admin by email
        const admin = await SupabaseDB.getUserByEmail(email);
        if (!admin || !admin.is_admin || admin.admin_id !== adminId) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }
        const validPassword = await bcrypt.compare(password, admin.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid admin credentials' });
        }
        const token = jwt.sign(
            { id: admin.id, email: admin.email, isAdmin: admin.is_admin },
            JWT_SECRET
        );
        
        // Map snake_case to camelCase for frontend compatibility
        const adminResponse = {
            id: admin.id,
            fullName: admin.full_name,
            adminName: admin.admin_name,
            email: admin.email,
            phoneNumber: admin.phone_number,
            adminId: admin.admin_id,
            isAdmin: admin.is_admin || false
        };
        
        res.json({ token, admin: adminResponse });
    } catch (error) {
        console.error('Error during admin login:', error);
        res.status(500).json({ error: 'Error during admin login' });
    }
});

// Get all vehicles
app.get('/api/vehicles/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const vehicles = await SupabaseDB.getVehicles(type);
        res.json(vehicles);
    } catch (error) {
        console.error(`Error fetching ${type}:`, error);
        res.status(500).json({ error: `Error fetching ${type}` });
    }
});

// Get a specific vehicle by type and ID
app.get('/api/vehicles/:type/:id', async (req, res) => {
    try {
        let { type, id } = req.params;
        console.log('Requested type:', type, 'Requested id:', id);
        if (type === 'car') type = 'cars';
        if (type === 'bike') type = 'bikes';
        if (type === 'scooty') type = 'scooty';
        console.log('Mapped type:', type, 'ID:', id);
        const vehicle = await SupabaseDB.getVehicleById(type, id);
        console.log('Vehicle result:', vehicle);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        res.json(vehicle);
    } catch (error) {
        console.error(`Error fetching vehicle:`, error);
        res.status(500).json({ error: 'Error fetching vehicle' });
    }
});

// Create booking
app.post('/api/bookings', authenticateToken, async (req, res) => {
    try {
        console.log('--- Booking Request Received ---');
        console.log('User:', req.user);
        console.log('Body:', req.body);
        const { vehicleId, startDate, startTime, duration, vehicleType, transactionId } = req.body;
        // Validate time format (HH:mm)
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(startTime)) {
            return res.status(400).json({ error: 'Invalid time format. Please use HH:mm format (24-hour)' });
        }
        // Convert startTime to 24-hour format if needed
        const [hours, minutes] = startTime.split(':').map(Number);
        const formattedStartTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        // Check for time conflicts
        const conflict = await checkTimeConflict(vehicleId, startDate, formattedStartTime, duration);
        if (conflict.conflict) {
            return res.status(409).json(conflict);
        }
        const bookingData = {
            user_id: req.user.id,
            vehicle_id: vehicleId,
            start_date: startDate,
            start_time: formattedStartTime, // Use formatted time
            duration,
            status: 'pending',
            vehicle_type: vehicleType,
            transaction_id: transactionId
        };
        console.log('Booking data to insert:', bookingData);
        const { data, error } = await supabase
            .from('bookings')
            .insert([bookingData])
            .select()
            .single();

        if (error) {
            console.error('Error creating booking:', error);
            return res.status(500).json({ error: 'Error creating booking', details: error.message || error });
        }

        console.log('Booking created:', data);
        // Update vehicle availability
        try {
            await SupabaseDB.updateVehicleAvailability(vehicleType, vehicleId, false);
        } catch (vehicleError) {
            console.error('Error updating vehicle availability:', vehicleError);
            // Optionally, you can add a warning to the response here
        }
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Error creating booking', details: error.message || error });
    }
});

// Get user bookings
app.get('/api/bookings/user', authenticateToken, async (req, res) => {
    try {
        const bookings = await SupabaseDB.getBookingsByUser(req.user.id);
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ error: 'Error fetching bookings' });
    }
});

// Dashboard Stats
app.get('/api/dashboard-stats', async (req, res) => {
    try {
        // Total vehicles = bikes + cars + scooty
        const { count: bikeCount } = await supabase.from('bikes').select('id', { count: 'exact', head: true });
        const { count: carCount } = await supabase.from('cars').select('id', { count: 'exact', head: true });
        const { count: scootyCount } = await supabase.from('scooty').select('id', { count: 'exact', head: true });
        const totalVehicles = (bikeCount || 0) + (carCount || 0) + (scootyCount || 0);

        // Users
        const { count: activeUsers } = await supabase.from('users').select('id', { count: 'exact', head: true });

        // Bookings
        const { count: totalBookingsMonth } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .gte('start_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);

        const { count: pendingBookings } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: confirmedBookings } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed');
        const { count: cancelledBookings } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'cancelled');
        const { count: pendingRefunds } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .in('status', ['cancelled', 'rejected'])
            .eq('refund_status', 'processing');

        // Today's bookings
        const today = new Date().toISOString().split('T')[0];
        const { count: todaysBookings } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', today + 'T00:00:00')
            .lt('created_at', today + 'T23:59:59');

        res.json({
            totalVehicles,
            totalBookingsMonth,
            activeUsers,
            pendingBookings,
            confirmedBookings,
            cancelledBookings,
            pendingRefunds,
            todaysBookings
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Error fetching dashboard stats' });
    }
});

// Admin: Get all users
app.get('/api/admin/users', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        // Map snake_case to camelCase for frontend compatibility
        const mapped = (data || []).map(u => ({
            id: u.id,
            fullName: u.full_name,
            adminName: u.admin_name,
            email: u.email,
            phoneNumber: u.phone_number,
            isAdmin: u.is_admin,
            isBlocked: u.is_blocked
        }));
        res.json(mapped);
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ error: 'Error fetching admin users' });
    }
});

// Admin: Get all vehicles
app.get('/api/admin/vehicles', async (req, res) => {
    try {
        const bikes = await supabase.from('bikes').select('*');
        const cars = await supabase.from('cars').select('*');
        const scooty = await supabase.from('scooty').select('*');
        const allVehicles = [
            ...(bikes.data || []).map(v => ({ ...v, type: 'bike' })),
            ...(cars.data || []).map(v => ({ ...v, type: 'car' })),
            ...(scooty.data || []).map(v => ({ ...v, type: 'scooty' }))
        ];
        res.json(allVehicles);
    } catch (error) {
        console.error('Error fetching admin vehicles:', error);
        res.status(500).json({ error: 'Error fetching admin vehicles' });
    }
});

// Admin: Get single user
app.get('/api/admin/users/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('*').eq('id', req.params.id).single();
        if (error) throw error;
        // Map snake_case to camelCase
        const user = {
            id: data.id,
            fullName: data.full_name,
            adminName: data.admin_name,
            email: data.email,
            phoneNumber: data.phone_number,
            isAdmin: data.is_admin,
            isBlocked: data.is_blocked,
            createdAt: data.created_at
        };
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Error fetching user' });
    }
});

// Admin: Update user
app.put('/api/admin/users/:id', async (req, res) => {
    try {
        const { fullName, email, phoneNumber } = req.body;
        const { data, error } = await supabase.from('users').update({ full_name: fullName, email, phone_number: phoneNumber }).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error updating user' });
    }
});

// Admin: Block/Unblock user
app.patch('/api/admin/users/:id/block', async (req, res) => {
    try {
        const { isBlocked } = req.body;
        const { data, error } = await supabase.from('users').update({ is_blocked: isBlocked }).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'Error updating user status' });
    }
});

// Admin: Get single vehicle
app.get('/api/admin/vehicles/:type/:id', async (req, res) => {
    try {
        let { type, id } = req.params;
        if (type === 'car') type = 'cars';
        if (type === 'bike') type = 'bikes';
        if (type === 'scooty') type = 'scooty';
        const { data, error } = await supabase.from(type).select('*').eq('id', id).single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching vehicle:', error);
        res.status(500).json({ error: 'Error fetching vehicle' });
    }
});

// Admin: Update vehicle
app.put('/api/admin/vehicles/:type/:id', async (req, res) => {
    try {
        let { type, id } = req.params;
        if (type === 'car') type = 'cars';
        if (type === 'bike') type = 'bikes';
        if (type === 'scooty') type = 'scooty';
        const { data, error } = await supabase.from(type).update(req.body).eq('id', id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating vehicle:', error);
        res.status(500).json({ error: 'Error updating vehicle' });
    }
});

// Admin: Delete vehicle
app.delete('/api/admin/vehicles/:type/:id', async (req, res) => {
    try {
        let { type, id } = req.params;
        if (type === 'car') type = 'cars';
        if (type === 'bike') type = 'bikes';
        if (type === 'scooty') type = 'scooty';
        const { error } = await supabase.from(type).delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Vehicle deleted successfully' });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ error: 'Error deleting vehicle' });
    }
});

// Admin: Get policies
app.get('/api/admin/policies', async (req, res) => {
    try {
        const { data, error } = await supabase.from('policies').select('*');
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching policies:', error);
        res.status(500).json({ error: 'Error fetching policies' });
    }
});

// Admin: Add new vehicle
app.post('/api/admin/vehicles/:type', async (req, res) => {
    try {
        let { type } = req.params;
        if (type === 'car') type = 'cars';
        if (type === 'bike') type = 'bikes';
        if (type === 'scooty') type = 'scooty';

        const { data, error } = await supabase
            .from(type)
            .insert([req.body])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error adding vehicle:', error);
        res.status(500).json({ error: 'Error adding vehicle' });
    }
});

// User: Cancel their own booking
app.post('/api/bookings/:id/cancel', verifyToken, async (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const userId = req.user.id;
        console.log('Processing user booking cancellation for ID:', bookingId);
        
        // First, fetch the booking
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('*, users:user_id(*)')
            .eq('id', bookingId)
            .eq('user_id', userId) // Ensure the booking belongs to the user
            .single();

        if (fetchError) {
            console.error('Error fetching booking:', fetchError);
            return res.status(500).json({ error: 'Error fetching booking details' });
        }

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found or unauthorized' });
        }

        if (booking.status !== 'confirmed') {
            return res.status(400).json({ error: 'Only confirmed bookings can be cancelled' });
        }

        // Calculate refund amount based on time since confirmation
        const now = new Date();
        const confirmationTime = booking.confirmation_timestamp ? new Date(booking.confirmation_timestamp) : now;
        const hoursSinceConfirmation = (now - confirmationTime) / (1000 * 60 * 60);
        
        console.log('Booking cancellation debug:', {
            confirmation_timestamp: booking.confirmation_timestamp,
            now: new Date().toISOString(),
            advance_payment: booking.advance_payment
        });

        let refundAmount = 0;
        // Calculate refund based on advance payment only
        const advancePayment = parseFloat(booking.advance_payment) || 100; // Default to 100 if not set
        if (hoursSinceConfirmation <= 2) {
            // Full refund of advance payment
            refundAmount = advancePayment;
        } else {
            // 70% refund of advance payment
            refundAmount = Math.round(advancePayment * 0.7);
        }

        console.log('hoursSinceConfirmation:', hoursSinceConfirmation);

        // Calculate deduction
        let deductionAmount = 0;
        if (hoursSinceConfirmation > 2) {
            deductionAmount = Math.round(advancePayment * 0.3);
        }
        // Use local time for cancelled_timestamp
        const nowCancel = new Date();
        const localCancelTimestamp = nowCancel.getFullYear() + '-' +
            String(nowCancel.getMonth() + 1).padStart(2, '0') + '-' +
            String(nowCancel.getDate()).padStart(2, '0') + ' ' +
            String(nowCancel.getHours()).padStart(2, '0') + ':' +
            String(nowCancel.getMinutes()).padStart(2, '0') + ':' +
            String(nowCancel.getSeconds()).padStart(2, '0');
        // Update booking status to cancelled with refund details, timestamps, and deduction
        const { data: updatedBooking, error: updateError } = await supabase
            .from('bookings')
            .update({ 
                status: 'cancelled',
                refund_amount: refundAmount,
                refund_status: 'processing',
                refund_details: req.body && req.body.refundDetails ? req.body.refundDetails : null,
                cancelled_timestamp: localCancelTimestamp,
                refund_deduction: deductionAmount
            })
            .eq('id', bookingId)
            .select('*, users:user_id(*)')
            .single();

        if (updateError) {
            console.error('Error updating booking:', updateError);
            return res.status(500).json({ error: 'Error updating booking status' });
        }

        // Update vehicle availability back to true
        if (booking.vehicle_id && booking.vehicle_type) {
            let vehicleTable = booking.vehicle_type;
            if (vehicleTable === 'car') vehicleTable = 'cars';
            if (vehicleTable === 'bike') vehicleTable = 'bikes';

            const { error: vehicleError } = await supabase
                .from(vehicleTable)
                .update({ is_available: true })
                .eq('id', booking.vehicle_id);

            if (vehicleError) {
                console.error('Error updating vehicle:', vehicleError);
            }
        }

        console.log('Booking cancelled successfully:', updatedBooking);

        res.json({
            message: 'Booking cancelled successfully',
            refundAmount,
            booking: updatedBooking
        });

    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ error: 'Error cancelling booking' });
    }
});

// Endpoint for user to submit refund details for a rejected booking
app.post('/api/bookings/:id/refund-details', verifyToken, async (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const userId = req.user.id;

        // Fetch the booking
        const { data: booking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .eq('user_id', userId)
            .single();

        if (fetchError) {
            console.error('Fetch error in refund-details endpoint:', fetchError);
            return res.status(500).json({ error: 'Error fetching booking details' });
        }
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found or unauthorized' });
        }
        if (booking.status !== 'rejected') {
            return res.status(400).json({ error: 'Refund details can only be submitted for rejected bookings' });
        }
        if (!req.body || !req.body.refundDetails) {
            return res.status(400).json({ error: 'Missing refund details' });
        }

        // Set refund_amount and refundAmount to full advance payment (default 100 if not set)
        const advancePayment = booking.advance_payment || booking.advancePayment || 100;

        // Update the booking with refund details, refund amount, and set refund_status to 'processing'
        const { data: updatedBooking, error: updateError } = await supabase
            .from('bookings')
            .update({ 
                refund_details: req.body.refundDetails,
                refund_amount: advancePayment,
                refund_status: 'processing',
                refund_deduction: 0 // Set deduction to 0 for rejected refunds (change if needed)
            })
            .eq('id', bookingId)
            .select('*')
            .single();

        if (updateError) {
            console.error('Update error in refund-details endpoint:', updateError);
            return res.status(500).json({ error: 'Error updating refund details' });
        }

        res.json({ message: 'Refund details submitted successfully', booking: updatedBooking });
    } catch (error) {
        console.error('Catch error in refund-details endpoint:', error);
        res.status(500).json({ error: 'Error submitting refund details', details: error.message });
    }
});

// Forgot Password: Request OTP
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user exists
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, full_name')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found with this email' });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        // Store OTP in database (you might want to create a separate table for this)
        const { error: otpError } = await supabase
            .from('password_reset_otps')
            .upsert({
                user_id: user.id,
                email: user.email,
                otp: otp,
                expires_at: otpExpiry.toISOString(),
                created_at: new Date().toISOString()
            });

        if (otpError) {
            console.error('Error storing OTP:', otpError);
            return res.status(500).json({ error: 'Error generating OTP' });
        }

        // Send OTP email
        const emailResult = await sendPasswordResetOTP(user.email, user.full_name, otp);

        if (emailResult.success) {
            res.json({ message: 'OTP sent successfully to your email' });
        } else {
            console.error('Failed to send OTP email:', emailResult.error);
            res.status(500).json({ error: 'Failed to send OTP email' });
        }

    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ error: 'Error processing forgot password request' });
    }
});

// Forgot Password: Verify OTP and Reset Password
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        // Verify OTP
        const { data: otpRecord, error: otpError } = await supabase
            .from('password_reset_otps')
            .select('*')
            .eq('email', email)
            .eq('otp', otp)
            .gte('expires_at', new Date().toISOString())
            .single();

        if (otpError || !otpRecord) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // If no new password provided, just verify OTP
        if (!newPassword) {
            res.json({ message: 'OTP verified successfully' });
            return;
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user password
        const { error: updateError } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('id', otpRecord.user_id);

        if (updateError) {
            console.error('Error updating password:', updateError);
            return res.status(500).json({ error: 'Error updating password' });
        }

        // Delete used OTP
        await supabase
            .from('password_reset_otps')
            .delete()
            .eq('id', otpRecord.id);

        res.json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Error in reset password:', error);
        res.status(500).json({ error: 'Error resetting password' });
    }
});

// Temporary email test endpoint (remove in production)
app.get('/test-email', async (req, res) => {
    try {
        const { sendPasswordResetOTP } = require('./config/emailService');
        const testEmail = process.env.EMAIL_USER || 'test@example.com';
        const result = await sendPasswordResetOTP(testEmail, 'Test User', '123456');
        res.json({
            success: true,
            message: 'Email test completed',
            result: result
        });
    } catch (error) {
        console.error('Email test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            emailConfig: {
                user: process.env.EMAIL_USER ? 'Set' : 'Not set',
                pass: process.env.EMAIL_PASS ? 'Set' : 'Not set'
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Email test endpoint: http://localhost:${PORT}/test-email`);
}); 
