import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { handlePrismaError } from "../../common/filters/prisma-exeption-handler.js";
import { hashPassword } from "../../common/utils/password.util.js";
import { logAction } from "../../common/utils/audit.util.js";
import { PrismaService } from "../../services/prisma/prisma.service.js";
import { CreateUserDto } from "./dto/create-user.dto.js";
import { SafeUser } from "./types/user.types.js";

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers(
    page = 1,
    limit = 10,
  ): Promise<{ data: SafeUser[]; total: number }> {
    try {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.user.findMany({
          where: { deletedAt: null },
          select: SAFE_USER_SELECT,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.user.count({
          where: { deletedAt: null },
        }),
      ]);

      return { data, total };
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async createUser(
    dto: CreateUserDto,
    actor?: { userId: string; ip?: string },
  ): Promise<SafeUser> {
    const existing = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        deletedAt: null,
      },
    });

    if (existing) throw new ConflictException("Email already in use");
    const password = await hashPassword(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: { ...dto, password },
        select: SAFE_USER_SELECT,
      });

      if (actor?.userId) {
        await logAction(this.prisma, {
          userId: actor.userId,
          action: "USER_CREATED",
          targetType: "User",
          targetId: user.id,
          ip: actor.ip,
          metadata: {
            createdUserId: user.id,
            byUserId: actor.userId,
            role: user.role,
          },
        });
      }

      return user;
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findByIdSafe(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async findByEmailWithPassword(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async deactivateUser(
    id: string,
    actor?: { userId: string; ip?: string },
  ): Promise<SafeUser> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: SAFE_USER_SELECT,
      });

      if (actor?.userId) {
        await logAction(this.prisma, {
          userId: actor.userId,
          action: "USER_DEACTIVATED",
          targetType: "User",
          targetId: id,
          ip: actor.ip,
          metadata: { byUserId: actor.userId },
        });
      }

      return user;
    } catch (error) {
      return handlePrismaError(error);
    }
  }

  async getAuditLogs(userId: string, page = 1, limit = 20) {
    await this.findByIdSafe(userId);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);

    return { data, total, page, limit };
  }

  async recordFailedLogin(id: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    if (user.failedLoginAttempts >= 5) {
      await this.prisma.user.update({
        where: { id },
        data: {
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
          failedLoginAttempts: 0,
        },
      });
    }
  }

  async resetFailedLogins(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }
}
