import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "./src/generated/prisma/client.js";

async function main() {
  const adapter = new PrismaLibSql({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
  const prisma = new PrismaClient({ adapter });
  const apps = await prisma.app.findMany();
  console.log("Apps count:", apps.length);
  if (apps[0]) console.log("First:", apps[0].name);
  await prisma.$disconnect();
}

main().catch((e) => console.error("ERROR:", e));
