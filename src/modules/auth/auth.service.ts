import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import * as crypto from "crypto";
import { Role } from "../../generated/prisma/enums.js";
import { AuthResult } from "../../common/types/auth.types.js";
import { JwtPayload, JwtUser } from "../../common/types/commonAuthTypes.js";
import { durationToMs } from "../../common/utils/durationToMs.js";
import { verifyPassword } from "../../common/utils/password.util.js";
import { logAction } from "../../common/utils/audit.util.js";
import { PrismaService } from "../../services/prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { SafeUser } from "../users/types/user.types.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    dto: LoginDto,
    meta: { ip?: string; userAgent?: string },
  ): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        "Account is temporarily locked. Try again later.",
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is disabled");
    }

    const isValid = await verifyPassword(user.password, dto.password);

    if (!isValid) {
      await this.usersService.recordFailedLogin(user.id);
      await logAction(this.prisma, {
        userId: user.id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user.id,
        ip: meta.ip,
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.usersService.resetFailedLogins(user.id);

    const refreshExpiresIn = this.configService.getOrThrow<string>(
      "jwt.refreshExpiresIn",
    );
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: "pending",
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: new Date(Date.now() + this.toMaxAge(refreshExpiresIn)),
      },
    });

    const { accessToken, refreshToken } = await this.issueToken(
      user.id,
      user.email,
      user.role,
      session.id,
    );

    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    await logAction(this.prisma, {
      userId: user.id,
      action: "LOGIN",
      targetType: "User",
      targetId: user.id,
      ip: meta.ip,
      metadata: { sessionId: session.id },
    });

    const safeUser: SafeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };

    return { user: safeUser, accessToken, refreshToken };
  }

  async refresh(
    actor: JwtUser,
    refreshToken: string,
    meta?: { ip?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const session = await this.prisma.session.findUnique({
      where: { id: actor.sessionId },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired or revoked");
    }

    if (session.refreshTokenHash !== this.hashToken(refreshToken)) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Invalid refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } = await this.issueToken(
      actor.userId,
      actor.email,
      actor.role,
      session.id,
    );

    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.hashToken(newRefreshToken) },
    });

    await logAction(this.prisma, {
      userId: actor.userId,
      action: "TOKEN_REFRESH",
      targetType: "Session",
      targetId: session.id,
      ip: meta?.ip,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(actor: JwtUser, meta?: { ip?: string }): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: actor.sessionId },
      select: { id: true, userId: true },
    });

    if (session) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await logAction(this.prisma, {
        userId: session.userId,
        action: "LOGOUT",
        targetType: "Session",
        targetId: session.id,
        ip: meta?.ip,
      });
    }
  }

  private async issueToken(
    userId: string,
    email: string,
    role: Role,
    sessionId: string,
  ) {
    const accessSecret = this.configService.getOrThrow<string>("jwt.accessSecret");
    const accessExpiresIn = this.configService.getOrThrow<string>(
      "jwt.accessExpiresIn",
    );
    const refreshSecret = this.configService.getOrThrow<string>(
      "jwt.refreshSecret",
    );
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      "jwt.refreshExpiresIn",
    );

    const payload: JwtPayload = { sub: userId, email, role, sessionId };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: this.toJwtExpires(accessExpiresIn),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: this.toJwtExpires(refreshExpiresIn),
    });

    return { accessToken, refreshToken };
  }

  private toJwtExpires(value: string): JwtSignOptions["expiresIn"] {
    if (/^\d+$/.test(value)) {
      return Number(value);
    }
    return value as JwtSignOptions["expiresIn"];
  }

  private toMaxAge(value: string): number {
    if (/^\d+$/.test(value)) {
      const asNumber = Number(value);
      return asNumber < 1000 ? asNumber * 1000 : asNumber;
    }
    return durationToMs(value);
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }
}
