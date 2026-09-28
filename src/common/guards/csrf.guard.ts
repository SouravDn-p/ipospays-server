import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";
import { REQUIRE_CSRF_KEY } from "../decorators/require-csrf.decorator.js";
import { CSRF_COOKIE } from "../utils/cookie.util.js";

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requireCsrf = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_CSRF_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic && !requireCsrf) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();

    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return true;
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const headerToken = req.headers["x-csrf-token"];
    const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (!cookieToken || !headerValue || cookieToken !== headerValue) {
      throw new ForbiddenException("Invalid or missing CSRF token");
    }

    return true;
  }
}
