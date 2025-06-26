const supabase = require('../config/supabase');

class SupabaseDB {
    // User operations
    static async createUser(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    static async getUserByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    static async updateUser(id, userData) {
        const { data, error } = await supabase
            .from('users')
            .update(userData)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    // Booking operations
    static async createBooking(bookingData) {
        const { data, error } = await supabase
            .from('bookings')
            .insert([bookingData])
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }

    static async getBookingsByUser(userId) {
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('user_id', userId);
        
        if (error) throw error;
        return data;
    }

    // Vehicle operations (bikes, cars, scooty)
    static async getVehicles(type) {
        const { data, error } = await supabase
            .from(type) // 'bikes', 'cars', or 'scooty'
            .select('*');
        
        if (error) throw error;
        return data;
    }

    static async getVehicleById(type, id) {
        const { data, error } = await supabase
            .from(type)
            .select('*')
            .eq('id', id)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    static async updateVehicleAvailability(type, id, isAvailable) {
        const { data, error } = await supabase
            .from(type)
            .update({ is_available: isAvailable })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }
}

module.exports = SupabaseDB; 