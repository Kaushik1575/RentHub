const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3005;
const JWT_SECRET = 'your-secret-key'; // Use a consistent secret key

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from the 'data' directory
app.use('/data', express.static(path.join(__dirname, 'data')));

// Data storage
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Initialize data files if they don't exist
const initializeDataFile = (filename, defaultData) => {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
};

initializeDataFile('users.json', []);
initializeDataFile('bikes.json', []);
initializeDataFile('bookings.json', []);
initializeDataFile('policies.json', []);

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
const adminOnly = (req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Add this after the existing middleware setup
const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log('Server: verifyAdminToken called.');
    console.log('Server: Authorization header:', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Server: No token provided or malformed header.');
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Server: Extracted token:', token);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Server: Token decoded:', decoded);
        if (!decoded.isAdmin) {
            console.log('Server: Token is not for an admin.');
            return res.status(403).json({ message: 'Not authorized as admin' });
        }
        req.user = decoded;
        console.log('Server: Admin token verified. User:', req.user);
        next();
    } catch (error) {
        console.error('Server: Token verification error:', error.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Function to check for time-based booking conflicts
function checkTimeConflict(existingBookings, vehicleId, startDate, startTime, duration) {
    // Convert start time to minutes for easier comparison
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = startTimeMinutes + (duration * 60);
    
    // Add 1-hour buffer before and after
    const bufferStartTime = startTimeMinutes - 60; // 1 hour before
    const bufferEndTime = endTimeMinutes + 60; // 1 hour after
    
    for (const booking of existingBookings) {
        // Skip if not the same vehicle or different date
        if (String(booking.vehicleId) !== String(vehicleId) || booking.startDate !== startDate) {
            continue;
        }
        
        // Skip cancelled or rejected bookings
        if (booking.status === 'cancelled' || booking.status === 'rejected') {
            continue;
        }
        
        // Convert existing booking time to minutes
        const [existingHour, existingMinute] = booking.startTime.split(':').map(Number);
        const existingStartTimeMinutes = existingHour * 60 + existingMinute;
        const existingEndTimeMinutes = existingStartTimeMinutes + (booking.duration * 60);
        
        // Check for overlap with buffer
        if (existingStartTimeMinutes < bufferEndTime && existingEndTimeMinutes > bufferStartTime) {
            return {
                conflict: true,
                existingBooking: booking,
                message: `Vehicle is already booked from ${booking.startTime} for ${booking.duration} hours. Please choose a different time slot with at least 1 hour gap.`
            };
        }
    }
    
    return { conflict: false };
}

// Helper function to read data from JSON file
const readData = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            if (data.trim() === '') {
                console.log(`Data file is empty: ${filePath}`);
                return [];
            }
            return JSON.parse(data);
        }
        console.log(`Data file not found: ${filePath}`);
        return [];
    } catch (error) {
        console.error(`Error reading or parsing data from ${filePath}:`, error);
        return [];
    }
};

// Function to load all vehicles from all files
const loadAllVehicles = () => {
    const bikes = readData(path.join(DATA_DIR, 'bikes.json'));
    const cars = readData(path.join(DATA_DIR, 'cars.json'));
    const scooters = readData(path.join(DATA_DIR, 'scooty.json'));
    return [...bikes, ...scooters, ...cars];
};

// User Registration
app.post('/api/register/user', async (req, res) => {
    try {
        const { fullName, email, phoneNumber, password } = req.body;
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: users.length + 1,
            fullName,
            email,
            phoneNumber,
            password: hashedPassword,
            isAdmin: false
        };

        users.push(newUser);
        fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
        
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
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));

        if (securityCode !== '1575') {
            return res.status(403).json({ error: 'Invalid Security Code. You are not authorized to register as admin.' });
        }

        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        if (users.find(u => u.adminId === adminId)) {
            return res.status(400).json({ error: 'Admin ID already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = {
            id: users.length + 1,
            adminName,
            email,
            adminId,
            password: hashedPassword,
            isAdmin: true
        };

        users.push(newAdmin);
        fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
        
        res.status(201).json({ message: 'Admin registered successfully' });
    } catch (error) {
        console.error('Error registering admin:', error);
        res.status(500).json({ error: 'Error registering admin' });
    }
});

// User Login
app.post('/api/login/user', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));

        // Find user by email
        const user = users.find(u => u.email === email && !u.isAdmin);
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // Create user object without sensitive data
        const userResponse = {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            isAdmin: false
        };

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: user.id,
                isAdmin: false,
                email: user.email 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: userResponse,
            message: 'User login successful'
        });
    } catch (error) {
        console.error('Error in user login:', error);
        res.status(500).json({ error: 'Error during login' });
    }
});

// Admin Login
app.post('/api/login/admin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        
        // Find admin by email
        const admin = users.find(u => u.email === email && u.isAdmin);
        if (!admin) {
            return res.status(400).json({ error: 'Admin not found' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, admin.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        // Create admin object without sensitive data
        const adminResponse = {
            id: admin.id,
            adminName: admin.adminName,
            email: admin.email,
            adminId: admin.adminId,
            isAdmin: true
        };

        // Generate JWT token
        const token = jwt.sign(
            { 
                id: admin.id,
                isAdmin: true,
                email: admin.email 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            admin: adminResponse,
            message: 'Admin login successful'
        });
    } catch (error) {
        console.error('Error in admin login:', error);
        res.status(500).json({ error: 'Error during login' });
    }
});

// Admin token verification endpoint
app.get('/api/admin/verify', verifyAdminToken, (req, res) => {
    try {
        const users = require('fs').existsSync(require('path').join(__dirname, 'data', 'users.json'))
            ? JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'data', 'users.json')))
            : [];
        // Compare IDs as strings for robustness
        const adminUser = users.find(u => String(u.id) === String(req.user.id) && u.isAdmin);
        res.json({
            id: req.user.id,
            adminName: adminUser ? (adminUser.adminName || adminUser.fullName || req.user.email) : req.user.email,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        });
    } catch (error) {
        console.error('Error in admin verification:', error);
        res.status(500).json({ error: 'Error during verification' });
    }
});

// Admin Dashboard Data
app.get('/api/dashboard-stats', verifyAdminToken, (req, res) => {
    try {
        const bikes = readData(path.join(DATA_DIR, 'bikes.json'));
        const cars = readData(path.join(DATA_DIR, 'cars.json'));
        const scooty = readData(path.join(DATA_DIR, 'scooty.json'));
        const bookings = readData(path.join(DATA_DIR, 'bookings.json'));
        const users = readData(path.join(DATA_DIR, 'users.json'));

        const totalVehicles = bikes.length + cars.length + scooty.length;
        const activeUsers = users.filter(user => !user.isAdmin).length;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const today = new Date().toISOString().split('T')[0];

        const totalBookingsMonth = bookings.filter(b => {
            const bookingDate = new Date(b.createdAt);
            return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
        }).length;

        const pendingBookings = bookings.filter(b => b.status === 'pending').length;
        const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
        const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
        const pendingRefunds = bookings.filter(b => b.status === 'cancelled' && b.refundStatus !== 'completed').length;
        const todaysBookings = bookings.filter(b => b.createdAt && b.createdAt.startsWith(today)).length;

        // Recent Activity: last 5 booking actions
        const recentActivity = bookings
            .sort((a, b) => new Date(b.updatedAt || b.cancelledTimestamp || b.confirmationTimestamp || b.createdAt) - new Date(a.updatedAt || a.cancelledTimestamp || a.confirmationTimestamp || a.createdAt))
            .slice(0, 5)
            .map(b => {
                const user = users.find(u => u.id === b.userId);
                const userName = user ? (user.fullName || user.adminName || 'Unknown User') : 'Unknown User';
                let type = 'created';
                let description = `Booking #${b.id} created by ${userName}`;
                let timestamp = b.createdAt;
                if (b.status === 'confirmed' && b.confirmationTimestamp) {
                    type = 'confirmed';
                    description = `Booking #${b.id} confirmed by ${userName}`;
                    timestamp = b.confirmationTimestamp;
                } else if (b.status === 'cancelled' && b.cancelledTimestamp) {
                    type = 'cancelled';
                    description = `Booking #${b.id} cancelled by ${userName}`;
                    timestamp = b.cancelledTimestamp;
                }
                return { type, description, timestamp };
            });

        res.json({
            totalVehicles,
            totalBookingsMonth,
            activeUsers,
            pendingBookings,
            confirmedBookings,
            cancelledBookings,
            pendingRefunds,
            todaysBookings,
            recentActivity
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Error fetching dashboard stats' });
    }
});

// Get all bookings
app.get('/api/admin/bookings', verifyAdminToken, (req, res) => {
    try {
        console.log('Fetching all bookings data...');
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        
        // Load all vehicle types
        const bikes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json')));
        const cars = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json')));
        const scooters = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scooty.json')));
        const allVehicles = [...bikes, ...scooters, ...cars];

        console.log('Raw Bookings:', bookings);
        console.log('Raw Users:', users);
        console.log('Total Vehicles loaded:', allVehicles.length);

        const enrichedBookings = bookings.map(booking => {
            const user = users.find(u => u.id === booking.userId);
            const vehicle = allVehicles.find(v => String(v.id) === String(booking.vehicleId)); // Search in all vehicle types

            const customerName = user ? user.fullName || user.adminName : 'Unknown Customer';
            const vehicleName = vehicle ? vehicle.name : 'Unknown Vehicle';

            const enrichedBooking = {
                ...booking,
                customerName,
                vehicleName
            };
            console.log('Enriched Booking:', enrichedBooking);
            return enrichedBooking;
        });

        console.log('Final Enriched Bookings sent to client:', enrichedBookings);
        res.json(enrichedBookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Error fetching bookings' });
    }
});

// Get a single booking by ID
app.get('/api/admin/bookings/:id', verifyAdminToken, (req, res) => {
    try {
        console.log('Fetching booking details for ID:', req.params.id);
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        const bikes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json')));
        const cars = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json')));
        const scooters = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scooty.json')));

        const booking = bookings.find(b => b.id === parseInt(req.params.id));
        if (!booking) {
            console.error('Booking not found:', req.params.id);
            return res.status(404).json({ message: `Booking with ID ${req.params.id} not found` });
        }

        // Find the user
        const user = users.find(u => u.id === booking.userId);
        if (!user) {
            console.error('User not found for booking:', booking.userId);
            return res.status(404).json({ message: `User associated with booking not found` });
        }

        // Robust vehicle lookup: search all vehicles for matching ID
        const allVehicles = [...bikes, ...scooters, ...cars];
        const vehicleId = booking.vehicleId.toString();
        const vehicle = allVehicles.find(v => String(v.id) === String(vehicleId));

        if (!vehicle) {
            console.error('Vehicle not found:', vehicleId);
            return res.status(404).json({ message: `Vehicle associated with booking not found` });
        }

        // Combine all the information
        const enrichedBooking = {
            ...booking,
            customerName: user.fullName || user.adminName,
            customerEmail: user.email,
            customerPhone: user.phoneNumber,
            vehicleName: vehicle.name,
            vehicleModel: vehicle.model || vehicle.name,
            vehicleCategory: vehicle.category || vehicle.type || 'N/A'
        };

        console.log('Sending enriched booking:', enrichedBooking);
        res.json(enrichedBooking);
    } catch (error) {
        console.error('Error getting booking details:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Get all users
app.get('/api/admin/users', verifyAdminToken, (req, res) => {
    try {
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        // Remove sensitive data
        const safeUsers = users.map(user => ({
            id: user.id,
            fullName: user.fullName || user.adminName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            isAdmin: user.isAdmin,
            isBlocked: user.isBlocked || false,
            createdAt: user.createdAt || new Date().toISOString()
        }));
        res.json(safeUsers);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// Get all vehicles (for admin view)
app.get('/api/admin/vehicles', verifyAdminToken, (req, res) => {
    try {
        const bikes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json')));
        const scooters = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scooty.json')));
        const cars = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json')));
        
        const allVehicles = [...bikes, ...scooters, ...cars];
        res.json(allVehicles);
    } catch (error) {
        console.error('Error fetching vehicles:', error);
        res.status(500).json({ error: 'Error fetching vehicles' });
    }
});

// Admin Booking Management
app.post('/api/admin/bookings/:id/confirm', verifyAdminToken, (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (bookings[bookingIndex].status !== 'pending') {
            return res.status(400).json({ error: 'Only pending bookings can be confirmed' });
        }

        // Always set confirmationTimestamp when confirming
        bookings[bookingIndex].status = 'confirmed';
        bookings[bookingIndex].confirmationTimestamp = new Date().toISOString();

        fs.writeFileSync(path.join(DATA_DIR, 'bookings.json'), JSON.stringify(bookings, null, 2));
        res.json({ message: 'Booking confirmed successfully' });
    } catch (error) {
        console.error('Error confirming booking:', error);
        res.status(500).json({ error: 'Error confirming booking' });
    }
});

app.post('/api/admin/bookings/:id/reject', verifyAdminToken, (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const { reason } = req.body;
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (bookings[bookingIndex].status !== 'pending') {
            return res.status(400).json({ error: 'Only pending bookings can be rejected' });
        }

        bookings[bookingIndex].status = 'rejected';
        bookings[bookingIndex].rejectionTimestamp = new Date().toISOString();
        bookings[bookingIndex].rejectionReason = reason;

        // Process refund for advance payment
        bookings[bookingIndex].refundAmount = bookings[bookingIndex].advancePayment;
        bookings[bookingIndex].refundStatus = 'completed';
        bookings[bookingIndex].refundTimestamp = new Date().toISOString();

        fs.writeFileSync(path.join(DATA_DIR, 'bookings.json'), JSON.stringify(bookings, null, 2));
        res.json({ message: 'Booking rejected successfully' });
    } catch (error) {
        console.error('Error rejecting booking:', error);
        res.status(500).json({ error: 'Error rejecting booking' });
    }
});

app.delete('/api/admin/bookings/:id', verifyAdminToken, (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Remove the booking
        bookings.splice(bookingIndex, 1);

        fs.writeFileSync(path.join(DATA_DIR, 'bookings.json'), JSON.stringify(bookings, null, 2));
        res.json({ message: 'Booking deleted successfully' });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({ error: 'Error deleting booking' });
    }
});

// Update a booking (admin only)
app.put('/api/admin/bookings/:id', verifyAdminToken, (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const { startDate, startTime, duration, totalAmount, advancePayment, remainingAmount, status } = req.body;
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const booking = bookings[bookingIndex];
        
        // Check for time-based conflicts with 1-hour buffer (excluding the current booking being edited)
        const otherBookings = bookings.filter(b => b.id !== bookingId);
        const conflictCheck = checkTimeConflict(otherBookings, booking.vehicleId, startDate, startTime, duration);
        if (conflictCheck.conflict) {
            return res.status(400).json({ error: conflictCheck.message });
        }

        // Update the booking
        bookings[bookingIndex] = {
            ...booking,
            startDate,
            startTime,
            duration,
            totalAmount,
            advancePayment,
            remainingAmount,
            status,
            updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(path.join(DATA_DIR, 'bookings.json'), JSON.stringify(bookings, null, 2));
        res.json({ message: 'Booking updated successfully' });
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({ error: 'Error updating booking' });
    }
});

// Get a single booking by ID (admin only)
app.get('/api/admin/bookings/:id', verifyAdminToken, (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        const allVehicles = [
            ...JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json'))),
            ...JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scooty.json'))),
            ...JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json')))
        ];

        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const user = users.find(u => u.id === booking.userId);
        const vehicle = allVehicles.find(v => String(v.id) === String(booking.vehicleId));

        const enrichedBooking = {
            ...booking,
            customerName: user ? user.fullName || user.adminName : 'Unknown Customer',
            vehicleName: vehicle ? vehicle.name : 'Unknown Vehicle',
            vehicleType: vehicle ? vehicle.type : 'N/A'
        };

        res.json(enrichedBooking);
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ error: 'Error fetching booking' });
    }
});

// Get all policies
app.get('/api/admin/policies', verifyAdminToken, (req, res) => {
    try {
        const policies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'policies.json')));
        res.json(policies);
    } catch (error) {
        console.error('Error fetching policies:', error);
        res.status(500).json({ error: 'Error fetching policies' });
    }
});

// Public endpoint to get a single vehicle by ID
app.get('/api/vehicles/:id', (req, res) => {
    try {
        const vehicleId = req.params.id;
        const allVehicles = loadAllVehicles();
        const vehicle = allVehicles.find(v => String(v.id) === String(vehicleId));

        if (!vehicle) {
            return res.status(404).json({ message: 'Vehicle not found' });
        }
        res.json(vehicle);
    } catch (error) {
        console.error('Error fetching vehicle data:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new booking
app.post('/api/bookings/new', authenticateToken, async (req, res) => {
    console.log('Final attempt: Received booking request at /api/bookings/new');
    console.log('Final attempt: Request Body:', req.body);

    try {
        const { vehicleId, vehicleType, startDate, startTime, duration, transactionId } = req.body;
        const userId = req.user.id;
        
        const parsedDuration = parseInt(duration, 10);
        const parsedVehicleId = String(vehicleId);

        console.log('Final attempt: Parsed Data:', { parsedVehicleId, vehicleType, startDate, startTime, parsedDuration, transactionId, userId });

        if (!parsedVehicleId || !vehicleType || !startDate || !startTime || isNaN(parsedDuration) || !transactionId) {
            console.log('Final attempt: Validation failed.');
            return res.status(400).json({ message: 'Missing or invalid required fields.' });
        }

        const bookings = readData(path.join(DATA_DIR, 'bookings.json'));
        const conflict = checkTimeConflict(bookings, parsedVehicleId, startDate, startTime, parsedDuration);
        if (conflict.conflict) {
            return res.status(409).json({ message: conflict.message });
        }

        const allVehicles = loadAllVehicles();
        const vehicle = allVehicles.find(v => String(v.id) === parsedVehicleId);
        if (!vehicle) {
            return res.status(404).json({ message: 'Vehicle not found.' });
        }

        const price = parseFloat(vehicle.price);
        if (isNaN(price)) {
            console.error('Final attempt: Vehicle price is not a valid number:', vehicle.price);
            return res.status(500).json({ message: 'Invalid vehicle price data.' });
        }

        // Corrected price calculation (assuming price is per hour)
        const totalAmount = price * parsedDuration;
        const advancePayment = 100;
        const remainingAmount = totalAmount - advancePayment;
        console.log('Final attempt: Calculated pricing:', { totalAmount, advancePayment, remainingAmount });

        const newBooking = {
            id: bookings.length > 0 ? Math.max(...bookings.map(b => b.id)) + 1 : 1,
            userId,
            vehicleId: parsedVehicleId,
            startDate,
            startTime,
            duration: parsedDuration,
            totalAmount,
            advancePayment,
            remainingAmount,
            transactionId,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        bookings.push(newBooking);
        fs.writeFileSync(path.join(DATA_DIR, 'bookings.json'), JSON.stringify(bookings, null, 2));
        console.log('Final attempt: Booking saved successfully.');

        res.status(201).json({ message: 'Booking request received and is pending confirmation.', booking: newBooking });

    } catch (error) {
        console.error('Final attempt: Error in /api/bookings/new endpoint:', error);
        res.status(500).json({ message: 'Server error while creating booking.' });
    }
});

// Get bookings for the authenticated user
app.get('/api/my-bookings', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        const allVehicles = [
            ...JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json'))),
            ...JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scooty.json'))),
            ...JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json')))
        ];

        const userBookings = bookings.filter(b => b.userId === userId);

        const enrichedBookings = userBookings.map(booking => {
            const user = users.find(u => u.id === booking.userId);
            const vehicle = allVehicles.find(v => String(v.id) === String(booking.vehicleId));

            const customerName = user ? user.fullName || user.adminName : 'Unknown Customer';
            const vehicleName = vehicle ? vehicle.name : 'Unknown Vehicle';
            const vehicleType = vehicle ? vehicle.type : 'N/A';

            // Calculate end date
            const startDate = new Date(booking.startDate);
            let endDate = 'Invalid Date';
            if (!isNaN(startDate.getTime())) {
                const calculatedEndDate = new Date(startDate);
                calculatedEndDate.setDate(startDate.getDate() + booking.duration);
                endDate = calculatedEndDate.toISOString().split('T')[0];
            }

            return {
                ...booking,
                customerName,
                vehicleName,
                vehicleType,
                endDate
            };
        });

        res.json(enrichedBookings);
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ error: 'Error fetching user bookings' });
    }
});

// Get user's own bookings
app.get('/api/user/bookings', authenticateToken, (req, res) => {
    try {
        const userId = req.user.id;
        const bookings = readData(path.join(DATA_DIR, 'bookings.json'));
        const userBookings = bookings.filter(b => b.userId === userId);

        const allVehicles = loadAllVehicles();

        const enrichedBookings = userBookings.map(booking => {
            const vehicle = allVehicles.find(v => String(v.id) === String(booking.vehicleId));
            
            const startDate = new Date(booking.startDate);
            let endDate = 'Invalid Date';
            if (!isNaN(startDate.getTime())) {
                const calculatedEndDate = new Date(startDate);
                calculatedEndDate.setHours(startDate.getHours() + booking.duration);
                endDate = calculatedEndDate.toISOString().split('T')[0];
            }

            return {
                ...booking,
                vehicleName: vehicle ? vehicle.name : 'Unknown Vehicle',
                vehicleType: vehicle ? (vehicle.type || 'N/A') : 'N/A',
                endDate
            };
        });

        res.json(enrichedBookings);
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({ error: 'Error fetching user bookings' });
    }
});

// Add a new vehicle (admin only)
app.post('/api/admin/vehicles', verifyAdminToken, async (req, res) => {
    try {
        const { name, category, image, price, engine, fuelType, mileage, available, rating, location } = req.body;

        if (!name || !category || !image || !price) {
            return res.status(400).json({ message: 'Missing required vehicle fields (name, category, image, price).' });
        }

        let vehicles = [];
        let filePath = '';

        switch (category) {
            case 'bike':
                filePath = path.join(DATA_DIR, 'bikes.json');
                vehicles = JSON.parse(fs.readFileSync(filePath));
                break;
            case 'scooter':
                filePath = path.join(DATA_DIR, 'scooty.json');
                vehicles = JSON.parse(fs.readFileSync(filePath));
                break;
            case 'car':
                filePath = path.join(DATA_DIR, 'cars.json');
                vehicles = JSON.parse(fs.readFileSync(filePath));
                break;
            default:
                return res.status(400).json({ message: 'Invalid vehicle category.' });
        }

        const newId = vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id)) + 1 : 1;

        const newVehicle = {
            id: newId,
            name,
            image,
            price: parseFloat(price),
            engine: engine || 'N/A',
            fuelType: fuelType || 'N/A',
            mileage: mileage || 'N/A',
            available: available === 'true',
            rating: rating !== undefined ? parseFloat(rating) : 0,
            location: location || 'N/A'
        };

        vehicles.push(newVehicle);
        fs.writeFileSync(filePath, JSON.stringify(vehicles, null, 2));

        res.status(201).json({ message: 'Vehicle added successfully', vehicle: newVehicle });
    } catch (error) {
        console.error('Error adding vehicle:', error);
        res.status(500).json({ message: 'Error adding vehicle' });
    }
});

// Add new user (admin only)
app.post('/api/admin/users', verifyAdminToken, async (req, res) => {
    try {
        const { fullName, email, phoneNumber, password } = req.body;
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: users.length + 1,
            fullName,
            email,
            phoneNumber,
            password: hashedPassword,
            isAdmin: false
        };

        users.push(newUser);
        fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
        
        res.status(201).json({ 
            message: 'User created successfully',
            user: {
                id: newUser.id,
                fullName: newUser.fullName,
                email: newUser.email,
                phoneNumber: newUser.phoneNumber,
                isAdmin: newUser.isAdmin
            }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
});

// Update user
app.put('/api/admin/users/:id', verifyAdminToken, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { fullName, email, phoneNumber, password } = req.body;
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if email already exists for other users
        const emailExists = users.find(u => u.email === email && u.id !== userId);
        if (emailExists) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Update user data
        users[userIndex] = {
            ...users[userIndex],
            fullName: fullName || users[userIndex].fullName,
            email: email || users[userIndex].email,
            phoneNumber: phoneNumber || users[userIndex].phoneNumber
        };

        // Update password if provided
        if (password) {
            users[userIndex].password = await bcrypt.hash(password, 10);
        }

        fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
        
        res.json({ 
            message: 'User updated successfully',
            user: {
                id: users[userIndex].id,
                fullName: users[userIndex].fullName,
                email: users[userIndex].email,
                phoneNumber: users[userIndex].phoneNumber,
                isAdmin: users[userIndex].isAdmin
            }
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error updating user' });
    }
});

// Delete user
app.delete('/api/admin/users/:id', verifyAdminToken, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user has any bookings
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const userBookings = bookings.filter(b => b.userId === userId);
        
        if (userBookings.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete user with existing bookings. Please cancel all bookings first.' 
            });
        }

        users.splice(userIndex, 1);
        fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error deleting user' });
    }
});

// Block/Unblock user
app.patch('/api/admin/users/:id/block', verifyAdminToken, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { isBlocked } = req.body;
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        users[userIndex].isBlocked = isBlocked;
        fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
        
        const action = isBlocked ? 'blocked' : 'unblocked';
        res.json({ 
            message: `User ${action} successfully`,
            user: {
                id: users[userIndex].id,
                fullName: users[userIndex].fullName,
                email: users[userIndex].email,
                isBlocked: users[userIndex].isBlocked
            }
        });
    } catch (error) {
        console.error('Error blocking/unblocking user:', error);
        res.status(500).json({ error: 'Error blocking/unblocking user' });
    }
});

// Get single user details
app.get('/api/admin/users/:id', verifyAdminToken, (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        
        const user = users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return user data without password
        const safeUser = {
            id: user.id,
            fullName: user.fullName || user.adminName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            isAdmin: user.isAdmin,
            isBlocked: user.isBlocked || false,
            createdAt: user.createdAt || new Date().toISOString()
        };

        res.json(safeUser);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Error fetching user' });
    }
});

// Cancel a booking (user or admin)
app.post('/api/bookings/:id/cancel', authenticateToken, (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        
        if (bookingIndex === -1) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const booking = bookings[bookingIndex];
        
        // Verify that the booking belongs to the user making the request
        if (booking.userId !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized to cancel this booking' });
        }

        if (booking.status !== 'confirmed') {
            return res.status(400).json({ message: 'Only confirmed bookings can be cancelled' });
        }

        // Check for confirmationTimestamp and return a clear error if missing
        if (!booking.confirmationTimestamp) {
            return res.status(400).json({ message: 'Booking is missing confirmation timestamp and cannot be cancelled. Please contact support.' });
        }

        const now = new Date();
        const confirmationTime = new Date(booking.confirmationTimestamp);
        const hoursSinceConfirmation = (now - confirmationTime) / (1000 * 60 * 60);
        let refundAmount = 0;
        let deduction = 0;

        // Calculate refund based on advance payment only
        if (hoursSinceConfirmation <= 2) {
            // Full refund of advance payment
            refundAmount = booking.advancePayment;
            deduction = 0;
        } else {
            // 70% refund of advance payment
            refundAmount = Math.round(booking.advancePayment * 0.7);
            deduction = booking.advancePayment - refundAmount;
        }

        booking.status = 'cancelled';
        booking.cancelledTimestamp = now.toISOString();
        booking.refundAmount = refundAmount;
        booking.refundStatus = 'processing';
        booking.refundDeduction = deduction;
        booking.refundProcessingTime = '1-2 hours';

        // Store refund details from user
        if (req.body && req.body.refundDetails) {
            booking.refundDetails = req.body.refundDetails;
        }

        bookings[bookingIndex] = booking;
        fs.writeFileSync(path.join(DATA_DIR, 'bookings.json'), JSON.stringify(bookings, null, 2));

        res.json({ 
            message: 'Booking cancelled', 
            refundAmount, 
            deduction, 
            refundStatus: 'processing',
            refundProcessingTime: '1-2 hours',
            booking 
        });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ message: 'Error cancelling booking' });
    }
});

// Mark refund as completed (admin)
app.post('/api/admin/bookings/:id/refund', verifyAdminToken, (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        const booking = bookings[bookingIndex];
        if (booking.status !== 'cancelled') {
            return res.status(400).json({ error: 'Only cancelled bookings can be marked as refunded' });
        }
        if (booking.refundStatus === 'completed') {
            return res.status(400).json({ error: 'Refund already marked as completed' });
        }
        booking.refundStatus = 'completed';
        booking.refundTimestamp = new Date().toISOString();
        bookings[bookingIndex] = booking;
        fs.writeFileSync(path.join(DATA_DIR, 'bookings.json'), JSON.stringify(bookings, null, 2));
        res.json({ message: 'Refund marked as completed', booking });
    } catch (error) {
        console.error('Error marking refund as completed:', error);
        res.status(500).json({ error: 'Error marking refund as completed' });
    }
});

// Get a single vehicle by ID (admin only)
app.get('/api/admin/vehicles/:id', verifyAdminToken, (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        const bikes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json')));
        const scooters = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scooty.json')));
        const cars = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json')));

        const allVehicles = [...bikes, ...scooters, ...cars];
        const vehicle = allVehicles.find(v => v.id === vehicleId);

        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Determine the vehicle type/category
        let category = 'unknown';
        if (bikes.find(v => v.id === vehicleId)) category = 'bike';
        else if (scooters.find(v => v.id === vehicleId)) category = 'scooter';
        else if (cars.find(v => v.id === vehicleId)) category = 'car';

        const vehicleWithCategory = {
            ...vehicle,
            category: category
        };

        res.json(vehicleWithCategory);
    } catch (error) {
        console.error('Error fetching vehicle:', error);
        res.status(500).json({ error: 'Error fetching vehicle' });
    }
});

// Update a vehicle (admin only)
app.put('/api/admin/vehicles/:id', verifyAdminToken, async (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        const { name, category, image, price, engine, fuelType, mileage, available, rating, location } = req.body;

        // Determine which file to update based on current vehicle location
        let bikes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json')));
        let scooters = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scooty.json')));
        let cars = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json')));

        let vehicleIndex = -1;
        let currentCategory = '';

        // Find the vehicle in its current file
        vehicleIndex = bikes.findIndex(v => v.id === vehicleId);
        if (vehicleIndex !== -1) {
            currentCategory = 'bike';
        } else {
            vehicleIndex = scooters.findIndex(v => v.id === vehicleId);
            if (vehicleIndex !== -1) {
                currentCategory = 'scooter';
            } else {
                vehicleIndex = cars.findIndex(v => v.id === vehicleId);
                if (vehicleIndex !== -1) {
                    currentCategory = 'car';
                }
            }
        }

        if (vehicleIndex === -1) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Update the vehicle
        const updatedVehicle = {
            id: vehicleId,
            name: name || bikes.find(v => v.id === vehicleId)?.name || scooters.find(v => v.id === vehicleId)?.name || cars.find(v => v.id === vehicleId)?.name,
            image: image || bikes.find(v => v.id === vehicleId)?.image || scooters.find(v => v.id === vehicleId)?.image || cars.find(v => v.id === vehicleId)?.image,
            price: parseFloat(price) || bikes.find(v => v.id === vehicleId)?.price || scooters.find(v => v.id === vehicleId)?.price || cars.find(v => v.id === vehicleId)?.price,
            engine: engine || bikes.find(v => v.id === vehicleId)?.engine || scooters.find(v => v.id === vehicleId)?.engine || cars.find(v => v.id === vehicleId)?.engine,
            fuelType: fuelType || bikes.find(v => v.id === vehicleId)?.fuelType || scooters.find(v => v.id === vehicleId)?.fuelType || cars.find(v => v.id === vehicleId)?.fuelType,
            mileage: mileage || bikes.find(v => v.id === vehicleId)?.mileage || scooters.find(v => v.id === vehicleId)?.mileage || cars.find(v => v.id === vehicleId)?.mileage,
            available: available !== undefined ? available : (bikes.find(v => v.id === vehicleId)?.available || scooters.find(v => v.id === vehicleId)?.available || cars.find(v => v.id === vehicleId)?.available),
            rating: rating !== undefined ? parseFloat(rating) : (bikes.find(v => v.id === vehicleId)?.rating || scooters.find(v => v.id === vehicleId)?.rating || cars.find(v => v.id === vehicleId)?.rating),
            location: location || bikes.find(v => v.id === vehicleId)?.location || scooters.find(v => v.id === vehicleId)?.location || cars.find(v => v.id === vehicleId)?.location
        };

        // Update in the appropriate file
        if (currentCategory === 'bike') {
            bikes[vehicleIndex] = updatedVehicle;
            fs.writeFileSync(path.join(DATA_DIR, 'bikes.json'), JSON.stringify(bikes, null, 2));
        } else if (currentCategory === 'scooter') {
            scooters[vehicleIndex] = updatedVehicle;
            fs.writeFileSync(path.join(DATA_DIR, 'scooty.json'), JSON.stringify(scooters, null, 2));
        } else if (currentCategory === 'car') {
            cars[vehicleIndex] = updatedVehicle;
            fs.writeFileSync(path.join(DATA_DIR, 'cars.json'), JSON.stringify(cars, null, 2));
        }

        res.json({ 
            message: 'Vehicle updated successfully', 
            vehicle: updatedVehicle 
        });
    } catch (error) {
        console.error('Error updating vehicle:', error);
        res.status(500).json({ error: 'Error updating vehicle' });
    }
});

// Delete a vehicle (admin only)
app.delete('/api/admin/vehicles/:id', verifyAdminToken, (req, res) => {
    try {
        const vehicleId = parseInt(req.params.id);
        
        // Check if vehicle has any bookings
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const vehicleBookings = bookings.filter(b => String(b.vehicleId) === String(vehicleId));
        
        if (vehicleBookings.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete vehicle with existing bookings. Please cancel all bookings first.' 
            });
        }

        // Find and remove from appropriate file
        let bikes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json')));
        let scooters = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scooty.json')));
        let cars = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json')));

        let vehicleIndex = bikes.findIndex(v => v.id === vehicleId);
        if (vehicleIndex !== -1) {
            bikes.splice(vehicleIndex, 1);
            fs.writeFileSync(path.join(DATA_DIR, 'bikes.json'), JSON.stringify(bikes, null, 2));
        } else {
            vehicleIndex = scooters.findIndex(v => v.id === vehicleId);
            if (vehicleIndex !== -1) {
                scooters.splice(vehicleIndex, 1);
                fs.writeFileSync(path.join(DATA_DIR, 'scooty.json'), JSON.stringify(scooters, null, 2));
            } else {
                vehicleIndex = cars.findIndex(v => v.id === vehicleId);
                if (vehicleIndex !== -1) {
                    cars.splice(vehicleIndex, 1);
                    fs.writeFileSync(path.join(DATA_DIR, 'cars.json'), JSON.stringify(cars, null, 2));
                } else {
                    return res.status(404).json({ error: 'Vehicle not found' });
                }
            }
        }

        res.json({ message: 'Vehicle deleted successfully' });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ error: 'Error deleting vehicle' });
    }
});

// Get a single vehicle by type and id (admin only)
app.get('/api/admin/vehicles/:type/:id', verifyAdminToken, (req, res) => {
    const { type, id } = req.params;
    let vehicles = [];
    if (type === 'car') {
        vehicles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cars.json')));
    } else if (type === 'bike') {
        vehicles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json')));
    } else if (type === 'scooty') {
        vehicles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'scooty.json')));
    } else {
        return res.status(400).json({ error: 'Invalid vehicle type' });
    }
    const vehicle = vehicles.find(v => String(v.id) === String(id));
    if (!vehicle) {
        return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle);
});

// Update a vehicle by type and id (admin only)
app.put('/api/admin/vehicles/:type/:id', verifyAdminToken, (req, res) => {
    const { type, id } = req.params;
    let vehicles = [];
    let file = '';
    if (type === 'car') {
        file = 'cars.json';
    } else if (type === 'bike') {
        file = 'bikes.json';
    } else if (type === 'scooty') {
        file = 'scooty.json';
    } else {
        return res.status(400).json({ error: 'Invalid vehicle type' });
    }
    vehicles = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file)));
    const idx = vehicles.findIndex(v => String(v.id) === String(id));
    if (idx === -1) {
        return res.status(404).json({ error: 'Vehicle not found' });
    }
    // Update fields
    vehicles[idx] = {
        ...vehicles[idx],
        ...req.body
    };
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(vehicles, null, 2));
    res.json({ message: 'Vehicle updated successfully', vehicle: vehicles[idx] });
});

// Endpoint for user to submit refund details for a rejected booking
app.post('/api/bookings/:id/refund-details', authenticateToken, (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const bookingIndex = bookings.findIndex(b => b.id === bookingId);
        if (bookingIndex === -1) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        const booking = bookings[bookingIndex];
        // Only allow if booking is rejected and belongs to the user
        if (booking.userId !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to update this booking' });
        }
        if (booking.status !== 'rejected') {
            return res.status(400).json({ message: 'Refund details can only be submitted for rejected bookings' });
        }
        if (!req.body || !req.body.refundDetails) {
            return res.status(400).json({ message: 'Missing refund details' });
        }
        booking.refundDetails = req.body.refundDetails;
        bookings[bookingIndex] = booking;
        fs.writeFileSync(path.join(DATA_DIR, 'bookings.json'), JSON.stringify(bookings, null, 2));
        res.json({ message: 'Refund details submitted successfully', booking });
    } catch (error) {
        console.error('Error submitting refund details:', error);
        res.status(500).json({ message: 'Error submitting refund details' });
    }
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 