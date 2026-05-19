// CLI: pnpm admin:create
// Creates an admin account by reading email + password from CLI args
// or env vars. Run with: pnpm admin:create -- --email=a@x.com --password=...

import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = /^--([^=]+)=(.+)$/.exec(a);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const email = args.email ?? process.env.ADMIN_EMAIL;
  const password = args.password ?? process.env.ADMIN_PASSWORD;
  const name = args.name ?? process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    console.error("Usage: pnpm admin:create -- --email=<email> --password=<password> [--name=<name>]");
    console.error("Or set ADMIN_EMAIL / ADMIN_PASSWORD env vars.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`Updating existing admin: ${email}`);
    const passwordHash = await bcrypt.hash(password, 12);
    const a = await prisma.admin.update({
      where: { email },
      data: { passwordHash, name },
    });
    console.log(`  → id ${a.id}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const a = await prisma.admin.create({
      data: { email, passwordHash, name },
    });
    console.log(`Created admin ${a.email} (id ${a.id})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
