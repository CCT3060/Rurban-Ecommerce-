import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const email = process.env.ADMIN_SEED_EMAIL || "admin@rurban.com";
const password = process.env.ADMIN_SEED_PASSWORD;

if (!password) {
  console.error("ERROR: ADMIN_SEED_PASSWORD environment variable is required.");
  console.error("Run: ADMIN_SEED_PASSWORD=<your-password> node --env-file=.env.local scripts/seed-admin.mjs");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(targetEmail) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    const users = data?.users || [];
    const match = users.find((user) => user.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) return match;

    if (users.length < perPage) return null;
    page += 1;
  }
}

async function seedAdmin() {
  let user = null;

  const { data: createdData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin User", role: "admin" },
    app_metadata: { role: "admin" },
  });

  if (createError) {
    const exists = createError.message.toLowerCase().includes("already") || createError.message.toLowerCase().includes("registered");
    if (!exists) {
      throw new Error(`Failed to create admin user: ${createError.message}`);
    }

    user = await findUserByEmail(email);
    if (!user) {
      throw new Error("Admin user exists but could not be fetched by email.");
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      email,
      password,
      user_metadata: {
        ...(user.user_metadata || {}),
        full_name: "Admin User",
        role: "admin",
      },
      app_metadata: {
        ...(user.app_metadata || {}),
        role: "admin",
      },
    });

    if (updateError) {
      throw new Error(`Failed to update existing admin user: ${updateError.message}`);
    }
  } else {
    user = createdData?.user || null;
  }

  if (!user?.id) {
    throw new Error("Admin user creation/update returned no user id.");
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: "Admin User",
      email,
      phone: null,
      avatar_url: null,
      role: "admin",
      is_active: true,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    throw new Error(`Failed to upsert admin profile: ${profileError.message}`);
  }

  console.log("Admin seed completed successfully.");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

seedAdmin().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
