const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function runMigration() {
    try {
        // Read the SQL file
        const sql = fs.readFileSync(
            path.join(__dirname, 'add-booking-columns.sql'),
            'utf8'
        );

        // Execute the SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql });
        
        if (error) {
            console.error('Migration failed:', error);
            return;
        }

        console.log('Migration completed successfully!');
        console.log('Added columns:', [
            'rejection_reason',
            'rejection_timestamp',
            'refund_amount',
            'refund_status',
            'refund_timestamp'
        ].join(', '));

    } catch (error) {
        console.error('Error running migration:', error);
    }
}

runMigration(); 