import { ApiProperty } from "@nestjs/swagger";
import { Role } from "../../../generated/prisma/enums.js";

export class UserResponseDto {
  @ApiProperty({ example: "8f3c2a1e-4b9d-4c6a-9e21-1a2b3c4d5e6f" })
  id: string;

  @ApiProperty({ example: "Jane Doe" })
  name: string;

  @ApiProperty({ example: "jane@example.com" })
  email: string;

  @ApiProperty({ enum: Role, example: Role.STAFF })
  role: Role;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({
    type: String,
    format: "date-time",
    nullable: true,
    example: "2026-09-28T05:00:00.000Z",
  })
  lastLoginAt: string | null;

  @ApiProperty({ example: "2026-09-01T10:00:00.000Z" })
  createdAt: Date;
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ example: 12 })
  total: number;
}

export class AuditLogItemDto {
  @ApiProperty({ example: "clx123abc" })
  id: string;

  @ApiProperty({ example: "8f3c2a1e-4b9d-4c6a-9e21-1a2b3c4d5e6f" })
  userId: string;

  @ApiProperty({ example: "LOGIN" })
  action: string;

  @ApiProperty({ example: "User" })
  targetType: string;

  @ApiProperty({ example: "8f3c2a1e-4b9d-4c6a-9e21-1a2b3c4d5e6f" })
  targetId: string;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    nullable: true,
    example: { ip: "127.0.0.1" },
  })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ example: "2026-09-28T05:00:00.000Z" })
  createdAt: Date;
}

export class PaginatedAuditLogsDto {
  @ApiProperty({ type: [AuditLogItemDto] })
  data: AuditLogItemDto[];

  @ApiProperty({ example: 4 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
