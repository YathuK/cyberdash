import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:./dev.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const libsql = createClient({ url, authToken });
const adapter = new PrismaLibSql({ url, authToken } as Parameters<typeof PrismaLibSql>[0]);
const prisma = new PrismaClient({ adapter });

const apps = [
  // Streaming
  {
    name: "YouTube",
    url: "https://www.youtube.com",
    icon: "youtube",
    category: "streaming",
    description: "Watch videos, live streams, and music",
    order: 1,
  },
  {
    name: "Netflix",
    url: "https://www.netflix.com",
    icon: "netflix",
    category: "streaming",
    description: "Stream movies and TV shows",
    order: 2,
  },
  {
    name: "Amazon Prime",
    url: "https://www.amazon.com/gp/video/storefront",
    icon: "prime",
    category: "streaming",
    description: "Movies, TV shows, and originals",
    order: 3,
  },
  {
    name: "Disney+",
    url: "https://www.disneyplus.com",
    icon: "disney",
    category: "streaming",
    description: "Disney, Pixar, Marvel, Star Wars",
    order: 4,
  },
  {
    name: "Twitch",
    url: "https://www.twitch.tv",
    icon: "twitch",
    category: "streaming",
    description: "Live streaming platform",
    order: 5,
  },
  {
    name: "Plex",
    url: "https://app.plex.tv",
    icon: "plex",
    category: "streaming",
    description: "Your personal media server",
    order: 6,
  },
  // Gaming
  {
    name: "Xbox Cloud",
    url: "https://www.xbox.com/play",
    icon: "xbox",
    category: "gaming",
    description: "Cloud gaming with Xbox Game Pass",
    order: 7,
  },
  {
    name: "GeForce NOW",
    url: "https://play.geforcenow.com",
    icon: "nvidia",
    category: "gaming",
    description: "NVIDIA cloud gaming",
    order: 8,
  },
  {
    name: "Luna",
    url: "https://luna.amazon.com",
    icon: "luna",
    category: "gaming",
    description: "Amazon cloud gaming",
    order: 9,
  },
  {
    name: "CrazyGames",
    url: "https://www.crazygames.com",
    icon: "games",
    category: "gaming",
    description: "Free browser games",
    order: 10,
  },
];

async function main() {
  console.log("Seeding database...");

  await prisma.app.deleteMany();

  for (const app of apps) {
    await prisma.app.create({ data: app });
  }

  console.log(`Seeded ${apps.length} apps`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
