import { CookieOptions, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { durationToMs } from "./durationToMs.js";
import * as crypto from "crypto";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
export const CSRF_COOKIE = "csrf_token";

export const REFRESH_COOKIE_PATH = "/api/v1/auth/refresh";

function isProd(config: ConfigService): boolean {
  return (
    config.get<string>("app.env") === "production"
    || config.get<string>("NODE_ENV") === "production"
  );
}

function toMaxAge(value: string | undefined, fallback: string): number {
  const raw = value ?? fallback;
  if (/^\d+$/.test(raw)) {
    const asNumber = Number(raw);
    return asNumber < 1000 ? asNumber * 1000 : asNumber;
  }
  return durationToMs(raw);
}

function accessMaxAge(config: ConfigService): number {
  return toMaxAge(config.get<string>("jwt.accessExpiresIn"), "15m");
}

function refreshMaxAge(config: ConfigService): number {
  return toMaxAge(config.get<string>("jwt.refreshExpiresIn"), "7d");
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  config: ConfigService,
): void {
  const prod = isProd(config);
  const sameSite = "strict" as const;

  const accessOptions: CookieOptions = {
    httpOnly: true,
    secure: prod,
    sameSite,
    maxAge: accessMaxAge(config),
    path: "/",
  };

  const refreshOptions: CookieOptions = {
    httpOnly: true,
    secure: prod,
    sameSite,
    maxAge: refreshMaxAge(config),
    path: REFRESH_COOKIE_PATH,
  };

  res.cookie(ACCESS_COOKIE, tokens.accessToken, accessOptions);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshOptions);
}

export function setCsrfCookie(res: Response, config: ConfigService): string {
  const prod = isProd(config);
  const csrfToken = crypto.randomBytes(32).toString("hex");

  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: prod,
    sameSite: "strict",
    path: "/",
    maxAge: refreshMaxAge(config),
  });

  return csrfToken;
}

export function clearAuthCookies(res: Response, config: ConfigService): void {
  const prod = isProd(config);
  const sameSite = "strict" as const;

  res.clearCookie(ACCESS_COOKIE, {
    path: "/",
    httpOnly: true,
    secure: prod,
    sameSite,
  });

  res.clearCookie(REFRESH_COOKIE, {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: prod,
    sameSite,
  });

  res.clearCookie(CSRF_COOKIE, {
    path: "/",
    httpOnly: false,
    secure: prod,
    sameSite,
  });
}
