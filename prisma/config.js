import { defineConfig } from "@prisma/config";

export default defineConfig({
  database: {
    connectionTimeout: 30000 // 30s
  }
});
