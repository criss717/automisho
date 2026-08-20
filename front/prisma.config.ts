import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Carga explícitamente el archivo .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
