require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@bikerental.com' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        // Create admin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const admin = new User({
            name: 'Admin User',
            email: 'admin@bikerental.com',
            password: hashedPassword,
            adminId: 'ADMIN001',
            isAdmin: true
        });

        await admin.save();
        console.log('Admin user created successfully');
        console.log('Email: admin@bikerental.com');
        console.log('Password: admin123');
        console.log('Admin ID: ADMIN001');
        console.log('Security Code: 123456');

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await mongoose.disconnect();
    }
}

createAdminUser(); 