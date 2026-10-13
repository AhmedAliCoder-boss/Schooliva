const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Load .env.local if present
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  env.forEach(line => {
    if (!line || line.trim().startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment or .env.local');
  process.exit(2);
}

async function main() {
  const candidateId = process.argv[2];
  const employeeId = process.argv[3];
  const schoolId = process.argv[4];
  if (!candidateId) {
    console.error('Usage: node create_hrm_auth_user.js <candidate_id> <employee_id> <school_id>');
    process.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  const rand = crypto.randomUUID();
  const tempEmail = `hrm-${rand}@accounts.schooliva.invalid`;
  const tempPassword = crypto.randomBytes(12).toString('base64').slice(0,20);

  console.log('Creating auth user (temporary email):', tempEmail);

  const { data, error } = await supabase.auth.admin.createUser({
    email: tempEmail,
    password: tempPassword,
    user_metadata: {
      hrm_hire_candidate_id: candidateId || null,
      hrm_hire_school_id: schoolId || null
    }
  });

  if (error) {
    console.error('Error creating auth user:', error);
    process.exit(3);
  }

  console.log('CREATED_USER_ID:' + data.user.id);
  // Print temp password so operator can note it if needed (warning: secret in stdout)
  console.log('TEMP_PASSWORD:' + tempPassword);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(4); });
