import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminId = process.env.ADMIN_ID || "admin";
  const adminName = process.env.ADMIN_NAME || "Administrator";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe1234!";

  const exists = await prisma.user.findUnique({ where: { id: adminId } });

  if (!exists) {
    const hashed = await argon2.hash(adminPassword);

    await prisma.user.create({
      data: {
        id: adminId,
        password: hashed,      // 컬럼명 password(해시 저장)
        name: adminName,
        globalRole: "ADMIN",
        isActive: true,
      },
    });

    console.log("Admin created:", adminId);
  } else {
    console.log("Admin already exists:", adminId);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
