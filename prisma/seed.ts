import "dotenv/config";
import * as argon2 from "argon2";
import pg from "pg";

type SeedAccount = {
  emailEnv: "SEED_USER_EMAIL" | "SEED_ADMIN_EMAIL";
  passwordEnv: "SEED_USER_PASSWORD" | "SEED_ADMIN_PASSWORD";
  role: "USER" | "SUPER_ADMIN";
  name: string;
};

const ACCOUNTS: SeedAccount[] = [
  {
    emailEnv: "SEED_USER_EMAIL",
    passwordEnv: "SEED_USER_PASSWORD",
    role: "USER",
    name: "User",
  },
  {
    emailEnv: "SEED_ADMIN_EMAIL",
    passwordEnv: "SEED_ADMIN_PASSWORD",
    role: "SUPER_ADMIN",
    name: "Admin",
  },
];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const databaseUrl = required("DATABASE_URL");
  const accounts = ACCOUNTS.map((account) => ({
    ...account,
    email: required(account.emailEnv).toLowerCase(),
    password: required(account.passwordEnv),
  }));

  const emails = new Set(accounts.map((account) => account.email));
  if (emails.size !== accounts.length) {
    throw new Error("SEED_USER_EMAIL and SEED_ADMIN_EMAIL must be different");
  }

  for (const account of accounts) {
    if (account.password.length < 8) {
      throw new Error(`${account.passwordEnv} must be at least 8 characters`);
    }
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'USER'`);

    for (const account of accounts) {
      const password = await argon2.hash(account.password, {
        type: argon2.argon2id,
      });
      await pool.query(
        `INSERT INTO users (
           id, name, email, password, role, "isActive", "failedLoginAttempts", "createdAt", "updatedAt"
         )
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::"Role", true, 0, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           password = EXCLUDED.password,
           role = EXCLUDED.role,
           "isActive" = true,
           "deletedAt" = NULL,
           "updatedAt" = NOW()`,
        [account.name, account.email, password, account.role],
      );
      console.log(`Seeded ${account.role} ${account.email}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
