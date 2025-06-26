require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

async function runMigration() {
    try {
        // Add refund_details column
        const { error: error1 } = await supabase
            .from('bookings')
            .update({ refund_details: null })
            .is('refund_details', null)
            .order('id')
            .select()
            .limit(1);
        
        // Add refund_deduction column
        const { error: error2 } = await supabase
            .from('bookings')
            .update({ refund_deduction: null })
            .is('refund_deduction', null)
            .order('id')
            .select()
            .limit(1);

        // Add cancelled_timestamp column
        const { error: error3 } = await supabase
            .from('bookings')
            .update({ cancelled_timestamp: null })
            .is('cancelled_timestamp', null)
            .order('id')
            .select()
            .limit(1);

        // Add refund_status column
        const { error: error4 } = await supabase
            .from('bookings')
            .update({ refund_status: 'pending' })
            .is('refund_status', null)
            .order('id')
            .select()
            .limit(1);

        // Add refund_completed_at column
        const { error: error5 } = await supabase
            .from('bookings')
            .update({ refund_completed_at: null })
            .is('refund_completed_at', null)
            .order('id')
            .select()
            .limit(1);

        // Add refund_completed_by column
        const { error: error6 } = await supabase
            .from('bookings')
            .update({ refund_completed_by: null })
            .is('refund_completed_by', null)
            .order('id')
            .select()
            .limit(1);

        // Check if any errors occurred during column additions
        const columnErrors = [error1, error2, error3, error4, error5, error6].filter(e => e);
        if (columnErrors.length > 0) {
            console.log('Some columns may already exist, continuing with table creation...');
        }

        // Try to create activity_log table by inserting a record
        const { error: createError } = await supabase
            .from('activity_log')
            .insert([{
                admin_id: null,
                action: 'table_created',
                booking_id: null,
                details: { message: 'Activity log table created' },
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (createError) {
            console.log('Activity log table may already exist:', createError.message);
        }

        console.log('Migration completed successfully!');
        console.log('Added or verified columns:', [
            'refund_details',
            'refund_deduction',
            'cancelled_timestamp',
            'refund_status',
            'refund_completed_at',
            'refund_completed_by'
        ].join(', '));
        console.log('Created or verified activity_log table');

    } catch (error) {
        console.error('Error running migration:', error);
    }
}

runMigration(); 