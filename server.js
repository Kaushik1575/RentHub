const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
initializeDataFile('scooters.json', []);
initializeDataFile('cars.json', []);
initializeDataFile('bookings.json', []);

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, 'your-secret-key', (err, user) => {
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

// Admin Authentication Middleware
const adminAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, 'your-secret-key');
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));
        const user = users.find(u => u.id === decoded.id);
        
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Not authorized as admin' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Routes
app.post('/api/register/user', async (req, res) => {
    const { fullName, email, phoneNumber, password, aadharNumber } = req.body;
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
        aadharNumber,
        isAdmin: false
    };

    users.push(newUser);
    fs.writeFileSync(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2));
    
    res.status(201).json({ message: 'User registered successfully' });
});

app.post('/api/register/admin', async (req, res) => {
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
});

// User Login
app.post('/api/login/user', async (req, res) => {
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
        'your-secret-key',
        { expiresIn: '24h' }
    );

    res.json({ 
        token, 
        user: userResponse,
        message: 'User login successful'
    });
});

// Admin Login
app.post('/api/login/admin', async (req, res) => {
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
        'your-secret-key',
        { expiresIn: '24h' }
    );

    res.json({ 
        token, 
        admin: adminResponse,
        message: 'Admin login successful'
    });
});

// Admin Dashboard Data
app.get('/api/admin/dashboard', authenticateToken, adminOnly, (req, res) => {
    try {
        const bikes = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bikes.json')));
        const bookings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bookings.json')));
        const users = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'users.json')));

        const today = new Date().toISOString().split('T')[0];
        const thisMonth = new Date().getMonth();

        const dashboardData = {
            totalBikes: bikes.length,
            pendingConfirmations: bookings.filter(b => b.status === 'pending').length,
            todayBookings: bookings.filter(b => b.startDate.startsWith(today)).length,
            activeUsers: users.filter(u => !u.isAdmin).length,
            rentedBikes: bookings.filter(b => b.status === 'confirmed').length,
            monthlyBookings: bookings.filter(b => new Date(b.startDate).getMonth() === thisMonth).length,
            monthlyRevenue: [0, 0, 0, 0, 0, 0], // Placeholder for monthly revenue
            pendingBookings: bookings.filter(b => b.status === 'pending').length,
            confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
            completedBookings: bookings.filter(b => b.status === 'completed').length,
            cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
            recentActivity: [] // Placeholder for recent activity
        };

        res.json(dashboardData);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching dashboard data' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 