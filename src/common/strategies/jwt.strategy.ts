import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt";
import { PrismaService } from "../../services/prisma/prisma.service.js";
import { JwtPayload, JwtUser } from "../types/commonAuthTypes.js";
import { ACCESS_COOKIE } from "../utils/cookie.util.js";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const secret = config.get<string>("jwt.accessSecret");
    if (!secret) {
      throw new Error("JWT_ACCESS_SECRET (jwt.accessSecret) is not set");
    }

    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string | null =>
          (req?.cookies?.[ACCESS_COOKIE] as string) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    };
    super(options);
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      select: {
        revokedAt: true,
        expiresAt: true,
        user: { select: { isActive: true } },
      },
    });

    if (
      !session
      || session.revokedAt
      || session.expiresAt < new Date()
      || !session.user.isActive
    ) {
      throw new UnauthorizedException("Session is no longer valid");
    }

    return {
      userId: String(payload.sub),
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    };
  }
}
