import { SetMetadata } from "@nestjs/common";

export const REQUIRE_CSRF_KEY = "requireCsrf";
export const RequireCsrf = () => SetMetadata(REQUIRE_CSRF_KEY, true);
