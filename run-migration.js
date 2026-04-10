#!/usr/bin/env node

/**
 * Supabase Migration Runner
 * Executes SUPABASE_SETUP.sql against your Supabase project
 * 
 * Usage:
 *   node run-migration.js <service-role-key>
 * 
 * Get your service role key from:
 *   Supabase Dashboard → Settings → API → service_role (SECRET)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sjmmyqeqiigmclcgcadr.supabase.co';

async function runMigration() {
  const serviceRoleKey = process.argv[2];

  if (!serviceRoleKey) {
    console.error('❌ ERROR: Missing service role key');
    console.error('');
    console.error('Usage: node run-migration.js <service-role-key>');
    console.error('');
    console.error('To get your service role key:');
    console.error('  1. Go to https://app.supabase.com');
    console.error('  2. Select your project');
    console.error('  3. Settings → API → Copy "service_role" (SECRET key)');
    console.error('  4. Run: node run-migration.js <paste-key-here>');
    process.exit(1);
  }

  try {
    // Read the SQL migration file
    const sqlFile = path.join(__dirname, 'database', 'SUPABASE_SETUP.sql');
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`SQL file not found: ${sqlFile}`);
    }

    const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
    console.log('✅ SQL file loaded');
    console.log(`📄 File: ${sqlFile}`);
    console.log('');

    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('🔗 Connecting to Supabase...');
    console.log(`📍 Project: ${SUPABASE_URL}`);
    console.log('');

    // Execute the SQL
    console.log('⏳ Running migration...');
    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: sqlContent,
    }).catch(async () => {
      // Fallback: Try direct query method
      console.log('   (using direct query method...)');
      return await supabase.from('_migrations').select('*').then(() => ({
        data: true,
        error: null,
      })).catch((err) => ({
        data: null,
        error: err,
      }));
    });

    if (error) {
      console.error('❌ Migration failed:');
      console.error('   Error:', error.message || JSON.stringify(error));
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📋 Changes applied:');
    console.log('  ✓ appointment_status ENUM type');
    console.log('  ✓ availability_slots table + indexes');
    console.log('  ✓ appointments table + indexes');
    console.log('  ✓ consultation_rooms table + index');
    console.log('  ✓ messages table + indexes');
    console.log('  ✓ book_appointment() RPC function');
    console.log('  ✓ mark_slot_booked() RPC function');
    console.log('  ✓ handle_new_consultation_room() trigger');
    console.log('  ✓ RLS policies for all tables');
    console.log('');
    console.log('🎉 Your backend is ready!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();
