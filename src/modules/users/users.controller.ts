import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Role } from "../../generated/prisma/enums.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import {
  ApiAuth,
  ApiCreatedAndError,
  ApiOkAndError,
} from "../../common/swagger/api-responses.decorators.js";
import { ApiResponse } from "../../common/types/global.js";
import { JwtUser } from "../../common/types/commonAuthTypes.js";
import { UsersService } from "./users.service.js";
import { CreateUserDto } from "./dto/create-user.dto.js";
import {
  PaginatedAuditLogsDto,
  PaginatedUsersDto,
  UserResponseDto,
} from "./dto/user-response.dto.js";

@ApiTags("users")
@ApiAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Current user" })
  @ApiOkAndError(UserResponseDto, "Current user fetched successfully")
  async me(@Req() req: Request) {
    const actor = req.user as JwtUser;
    const user = await this.usersService.findByIdSafe(actor.userId);
    return ApiResponse.success(user, "Current user fetched successfully");
  }

  @Roles(Role.SUPER_ADMIN)
  @Get()
  @ApiOperation({ summary: "List users" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiOkAndError(PaginatedUsersDto, "Users fetched successfully")
  async getAll(@Query("page") page = 1, @Query("limit") limit = 20) {
    const result = await this.usersService.getAllUsers(Number(page), Number(limit));
    return ApiResponse.success(result, "Users fetched successfully");
  }

  @Roles(Role.SUPER_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create user" })
  @ApiCreatedAndError(UserResponseDto, "User created successfully")
  async create(@Req() req: Request, @Body() dto: CreateUserDto) {
    const actor = req.user as JwtUser;
    const user = await this.usersService.createUser(dto, {
      userId: actor.userId,
      ip: req.ip,
    });
    return ApiResponse.success(user, "User created successfully", 201);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get(":id/audit-logs")
  @ApiOperation({ summary: "User audit logs" })
  @ApiParam({ name: "id" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiOkAndError(PaginatedAuditLogsDto, "Audit logs fetched")
  async getAuditLogs(
    @Param("id") id: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ) {
    const logs = await this.usersService.getAuditLogs(id, Number(page), Number(limit));
    return ApiResponse.success(logs, "Audit logs fetched");
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(":id/deactivate")
  @ApiOperation({ summary: "Deactivate user" })
  @ApiParam({ name: "id" })
  @ApiOkAndError(UserResponseDto, "User deactivated successfully")
  async deactivate(@Req() req: Request, @Param("id") id: string) {
    const actor = req.user as JwtUser;
    const user = await this.usersService.deactivateUser(id, {
      userId: actor.userId,
      ip: req.ip,
    });
    return ApiResponse.success(user, "User deactivated successfully");
  }
}
