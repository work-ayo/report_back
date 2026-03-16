import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertAdmin() {
  const loginId = process.env.ADMIN_ID ?? "admin";
  const name = process.env.ADMIN_NAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin1234";

  const exists = await prisma.user.findUnique({
    where: { id: loginId },
  });

  if (exists) {
    console.log("admin already exists:", exists.userId);
    return exists;
  }

  const hashed = await argon2.hash(password);

  const admin = await prisma.user.create({
    data: {
      id: loginId,
      password: hashed,
      name,
      globalRole: "ADMIN",
      isActive: true,
    },
  });

  console.log("admin created:", admin.userId);
  return admin;
}

async function main() {
  await upsertAdmin();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });