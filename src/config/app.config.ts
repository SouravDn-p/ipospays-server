import { registerAs } from "@nestjs/config";

export interface AppConfig {
  port: number;
  env: string;
  corsOrigin: string;
}

export default registerAs<AppConfig>(
  "app",
  (): AppConfig => ({
    port: Number(process.env.PORT) || 7000,
    env: process.env.NODE_ENV || "development",
    corsOrigin:
      process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001",
  }),
);
