import { Controller, Get, HttpStatus } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppService } from "./app.service.js";
import { Public } from "./common/decorators/public.decorator.js";
import { ApiOkAndError } from "./common/swagger/api-responses.decorators.js";
import { ApiResponse } from "./common/types/global.js";
import { HealthDataDto } from "./common/dto/health-response.dto.js";

@ApiTags("health")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Health check" })
  @ApiOkAndError(
    HealthDataDto,
    "Request successful",
    HttpStatus.INTERNAL_SERVER_ERROR,
    "Server error",
  )
  getHello() {
    const data = this.appService.getHello();
    return ApiResponse.success({ greeting: data });
  }
}
