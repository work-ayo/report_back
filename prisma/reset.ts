import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Reset(TRUNCATE) started...");
    if (process.env.NODE_ENV === "production") {
    throw new Error("Reset is blocked in production.");
  }

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "TeamMember", "Team", "User"
    RESTART IDENTITY CASCADE;
  `);

  console.log("Reset(TRUNCATE) done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
