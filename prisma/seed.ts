import "dotenv/config";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminId = process.env.ADMIN_ID;
  const adminName = process.env.ADMIN_NAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminId || !adminName || !adminPassword) {
    console.error("check admin information!");
    return;
  }

  const exists = await prisma.user.findUnique({ where: { id: adminId } });

  if (!exists) {
    const hashed = await argon2.hash(adminPassword);

    await prisma.user.create({
      data: {
        id: adminId,
        password: hashed,
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

async function createTester(){
  const id = "user";
  const name = "user";
  const pw = "user1234";

  if (!id || !name || !pw) {
    console.error("check user information!");
    return;
  }

  const exists = await prisma.user.findUnique({ where: { id: id } });

  if (!exists) {
    const hashed = await argon2.hash(pw);

    await prisma.user.create({
      data: {
        id: id,
        password: hashed,
        name: name,
        globalRole: "USER",
        isActive: true,
      },
    });



    console.log("user created:", id);
  } else {
    console.log("user already exists:", id);
  }

  
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
