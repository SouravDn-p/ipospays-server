import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../services/prisma/prisma.service.js";

export type AuditParams = {
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  ip?: string;
  metadata?: Record<string, unknown>;
};

export async function logAction(
  prisma: PrismaService,
  params: AuditParams,
): Promise<void> {
  const metadata: Prisma.InputJsonValue | undefined =
    params.metadata || params.ip
      ? {
          ...(params.metadata ?? {}),
          ...(params.ip ? { ip: params.ip } : {}),
        }
      : undefined;

  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata,
    },
  });
}
