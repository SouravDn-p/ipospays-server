import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { CsrfGuard } from "../../common/guards/csrf.guard.js";
import { JwtAuthGuard } from "../../common/guards/jwt.auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { JwtRefreshStrategy } from "../../common/strategies/jwt-refresh.strategy.js";
import { JwtStrategy } from "../../common/strategies/jwt.strategy.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AuthModule {}
