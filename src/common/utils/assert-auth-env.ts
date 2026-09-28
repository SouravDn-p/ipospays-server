import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";

const REQUIRED_JWT_KEYS = [
  "jwt.accessSecret",
  "jwt.refreshSecret",
  "jwt.accessExpiresIn",
  "jwt.refreshExpiresIn",
] as const;

export function assertRequiredAuthEnv(config: ConfigService): void {
  const logger = new Logger("AuthEnv");
  const missing: string[] = [];

  for (const key of REQUIRED_JWT_KEYS) {
    const value = config.get<string>(key);
    if (!value || value.trim().length === 0) {
      missing.push(key);
    }
  }

  const env = config.get<string>("app.env") ?? process.env.NODE_ENV ?? "development";

  if (missing.length > 0) {
    const message = `Missing required auth config: ${missing.join(", ")}`;
    if (env === "production") {
      throw new Error(message);
    }
    logger.warn(`${message} (dev fallbacks may apply via jwt.config)`);
  }

  if (env === "production") {
    const weak = [
      config.get<string>("jwt.accessSecret"),
      config.get<string>("jwt.refreshSecret"),
    ].filter((s) => s?.startsWith("dev-only-") || s?.startsWith("fallback-"));

    if (weak.length > 0) {
      throw new Error("Production refuses weak/dev JWT secret fallbacks");
    }
  }
}
