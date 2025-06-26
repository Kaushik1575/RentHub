const fs = require('fs').promises;
const path = require('path');
const supabase = require('../config/supabase');

async function readJsonFile(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
}

// Function to determine vehicle type based on vehicle ID and all vehicle data
function determineVehicleType(vehicleId, bikes, cars, scooty) {
    // Convert vehicleId to number for comparison
    const id = parseInt(vehicleId);
    
    // Check in bikes
    if (bikes.some(bike => bike.id === id)) return 'bike';
    
    // Check in cars
    if (cars.some(car => car.id === id)) return 'car';
    
    // Check in scooty
    if (scooty.some(s => s.id === id)) return 'scooty';
    
    // Default to bike if not found (you might want to handle this differently)
    return 'bike';
}

async function clearExistingData() {
    console.log('Clearing existing data...');
    
    // Delete data from all tables
    await supabase.from('bookings').delete().neq('id', 0);
    await supabase.from('bikes').delete().neq('id', 0);
    await supabase.from('cars').delete().neq('id', 0);
    await supabase.from('scooty').delete().neq('id', 0);
    await supabase.from('users').delete().neq('id', 0);
    await supabase.from('policies').delete().neq('id', 0);
    
    console.log('Existing data cleared successfully');
}

async function migrateData() {
    try {
        // Clear existing data first
        await clearExistingData();

        // First, read all vehicle data to help determine types for bookings
        const bikes = await readJsonFile(path.join(__dirname, '../data/bikes.json'));
        const cars = await readJsonFile(path.join(__dirname, '../data/cars.json'));
        const scooty = await readJsonFile(path.join(__dirname, '../data/scooty.json'));

        // Migrate users
        console.log('Migrating users...');
        const users = await readJsonFile(path.join(__dirname, '../data/users.json'));
        const formattedUsers = users.map(user => ({
            id: user.id,
            full_name: user.fullName,
            email: user.email,
            phone_number: parseInt(user.phoneNumber),
            password: user.password,
            is_admin: user.isAdmin,
            admin_name: user.adminName,
            admin_id: user.adminId,
            aadhar_number: user.aadharNumber ? parseInt(user.aadharNumber) : null,
            is_blocked: user.isBlocked || false
        }));
        const { error: usersError } = await supabase.from('users').insert(formattedUsers);
        if (usersError) throw usersError;
        console.log('Users migrated successfully');

        // Migrate bikes
        console.log('Migrating bikes...');
        const formattedBikes = bikes.map(bike => ({
            id: bike.id,
            name: bike.name,
            engine: bike.engine || 'Standard Engine',
            fuel_type: bike.fuelType || 'Petrol',
            price: parseFloat(bike.price),
            is_available: bike.available !== false,
            image_url: bike.image || bike.imageUrl
        }));
        const { error: bikesError } = await supabase.from('bikes').insert(formattedBikes);
        if (bikesError) throw bikesError;
        console.log('Bikes migrated successfully');

        // Migrate cars
        console.log('Migrating cars...');
        const formattedCars = cars.map(car => ({
            id: car.id,
            name: car.name,
            engine: car.engine || 'Standard Engine',
            fuel_type: car.fuelType || 'Petrol',
            price: parseFloat(car.price),
            is_available: car.available !== false,
            image_url: car.image || car.imageUrl
        }));
        const { error: carsError } = await supabase.from('cars').insert(formattedCars);
        if (carsError) throw carsError;
        console.log('Cars migrated successfully');

        // Migrate scooty
        console.log('Migrating scooty...');
        const formattedScooty = scooty.map(s => ({
            id: s.id,
            name: s.name,
            engine: s.engine || 'Standard Engine',
            fuel_type: s.fuelType || 'Petrol',
            price: parseFloat(s.price),
            is_available: s.available !== false,
            image_url: s.image || s.imageUrl
        }));
        const { error: scootyError } = await supabase.from('scooty').insert(formattedScooty);
        if (scootyError) throw scootyError;
        console.log('Scooty migrated successfully');

        // Migrate bookings
        console.log('Migrating bookings...');
        const bookings = await readJsonFile(path.join(__dirname, '../data/bookings.json'));
        const formattedBookings = bookings.map(booking => ({
            id: booking.id,
            user_id: booking.userId,
            vehicle_id: parseInt(booking.vehicleId),
            vehicle_type: determineVehicleType(booking.vehicleId, bikes, cars, scooty),
            start_date: booking.startDate,
            start_time: booking.startTime,
            duration: parseInt(booking.duration),
            status: booking.status || 'pending'
        }));
        const { error: bookingsError } = await supabase.from('bookings').insert(formattedBookings);
        if (bookingsError) throw bookingsError;
        console.log('Bookings migrated successfully');

        // Migrate policies
        console.log('Migrating policies...');
        const policies = await readJsonFile(path.join(__dirname, '../data/policies.json'));
        const { error: policiesError } = await supabase.from('policies').insert(policies);
        if (policiesError) throw policiesError;

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateData(); 