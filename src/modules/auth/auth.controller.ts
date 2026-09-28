import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator.js";
import { RequireCsrf } from "../../common/decorators/require-csrf.decorator.js";
import { JwtRefreshGuard } from "../../common/guards/jwt-refresh.guard.js";
import {
  ApiAuth,
  ApiMessageAndError,
  ApiOkAndError,
} from "../../common/swagger/api-responses.decorators.js";
import { ApiResponse } from "../../common/types/global.js";
import { JwtUser } from "../../common/types/commonAuthTypes.js";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
  setCsrfCookie,
} from "../../common/utils/cookie.util.js";
import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { LoginDataDto, RefreshDataDto } from "./dto/auth-response.dto.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log in" })
  @ApiOkAndError(
    LoginDataDto,
    "Logged in successfully",
    HttpStatus.UNAUTHORIZED,
    "Invalid credentials",
  )
  @Post("login")
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    const result = await this.authService.login(dto, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    setAuthCookies(
      res,
      { accessToken: result.accessToken, refreshToken: result.refreshToken },
      this.config,
    );
    const csrfToken = setCsrfCookie(res, this.config);

    return ApiResponse.success(
      { user: result.user, csrfToken },
      "Logged in successfully",
    );
  }

  @Public()
  @RequireCsrf()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh tokens" })
  @ApiOkAndError(
    RefreshDataDto,
    "Token refreshed",
    HttpStatus.UNAUTHORIZED,
    "Session expired or invalid refresh token",
  )
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const actor = req.user as JwtUser;
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string;
    const tokens = await this.authService.refresh(actor, refreshToken, {
      ip: req.ip,
    });
    setAuthCookies(res, tokens, this.config);
    const csrfToken = setCsrfCookie(res, this.config);
    return ApiResponse.success({ csrfToken }, "Token refreshed");
  }

  @ApiAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log out" })
  @ApiMessageAndError("Logged out successfully")
  @Post("logout")
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const actor = req.user as JwtUser;
    await this.authService.logout(actor, { ip: req.ip });
    clearAuthCookies(res, this.config);
    return ApiResponse.success(null, "Logged out successfully");
  }
}
