
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env.local manually to avoid installing dotenv
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Missing Supabase Credentials in .env.local");
    process.exit(1);
}

console.log("Found Supabase URL:", supabaseUrl);
// console.log("Found Service Key:", serviceRoleKey.substring(0, 10) + "...");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
    console.log("\n🚀 Starting Project Reset...\n");

    // 1. DELETE USERS
    console.log("--- Cleaning Auth Users ---");
    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;

        console.log(`Found ${users.length} users.`);

        for (const user of users) {
            console.log(`Deleting user: ${user.email} (${user.id})`);
            const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
            if (delError) console.error(`Failed to delete ${user.email}:`, delError.message);
            else console.log(`✅ Deleted ${user.email}`);
        }
    } catch (e) {
        console.error("Error listing/deleting users:", e);
    }

    // 2. TRUNCATE DATA (Using DELETE all for simplicity without RPC)
    console.log("\n--- Cleaning Database Tables ---");

    // Properties
    try {
        // Delete all rows where id is not null (effectively all)
        // Assuming 'id' is a column. If not, this might fail, but standard Supabase setup has 'id'.
        // If RLS is enabled, Service Role bypasses it.
        const { error, count } = await supabase.from('properties').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
            // If table doesn't exist, ignore
            if (error.code === '42P01') console.log("Table 'properties' does not exist (OK).");
            else console.error("Error clearing properties:", error.message);
        } else {
            console.log(`✅ Cleared properties table.`);
        }
    } catch (e) {
        console.error("Error clearing properties:", e);
    }

    // Public Users (if sync table exists)
    try {
        const { error } = await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
            if (error.code === '42P01') console.log("Table 'users' (public) does not exist (OK).");
            else console.error("Error clearing public users:", error.message);
        } else {
            console.log(`✅ Cleared public users table.`);
        }
    } catch (e) {
        console.error("Error clearing public users:", e);
    }

    console.log("\n✨ Reset Complete. Ready for fresh testing.");
}

main();
