import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt";
import { JwtPayload, JwtUser } from "../types/commonAuthTypes.js";
import { REFRESH_COOKIE } from "../utils/cookie.util.js";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor(config: ConfigService) {
    const secret = config.get<string>("jwt.refreshSecret");
    if (!secret) {
      throw new Error("JWT_REFRESH_SECRET (jwt.refreshSecret) is not set");
    }

    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string | null =>
          (req?.cookies?.[REFRESH_COOKIE] as string) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    };

    super(options);
  }

  validate(payload: JwtPayload): JwtUser {
    return {
      userId: String(payload.sub),
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    };
  }
}
