import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator.js";
import {
  ApiAuth,
  ApiCreatedAndError,
  ApiOkAndError,
} from "../../common/swagger/api-responses.decorators.js";
import { ApiResponse } from "../../common/types/global.js";
import { CreateHostedPaymentDto } from "./dto/create-hosted-payment.dto.js";
import {
  HostedPaymentDto,
  IposConnectionDto,
  PaymentStatusDto,
} from "./dto/payment-response.dto.js";
import { PaymentsService } from "./payments.service.js";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Get("ipospays/connection")
  @ApiOperation({
    summary: "Check sandbox credentials",
    description:
      "Requests an iPOSpays auth token with the configured API key and secret. The token is not returned.",
  })
  @ApiOkAndError(
    IposConnectionDto,
    "Sandbox credentials accepted",
    HttpStatus.BAD_GATEWAY,
    "iPOSpays rejected the credentials",
  )
  async connection() {
    const data = await this.payments.connection();
    return ApiResponse.success(data, "Sandbox credentials accepted");
  }

  @ApiAuth()
  @Post("hosted-page")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create an iPOSpays hosted payment page",
    description:
      "Uses the active IPOSPAYS_ENV host. Sandbox is *.ipospays.tech. Production is *.ipospays.com.",
  })
  @ApiCreatedAndError(HostedPaymentDto, "Hosted payment page created")
  async createHostedPage(@Body() dto: CreateHostedPaymentDto) {
    const data = await this.payments.createHostedPayment(dto);
    return ApiResponse.success(data, "Hosted payment page created", 201);
  }

  @ApiAuth()
  @Get("status/:transactionReferenceId")
  @ApiOperation({ summary: "Query iPOSpays payment status" })
  @ApiParam({ name: "transactionReferenceId" })
  @ApiOkAndError(PaymentStatusDto, "Payment status fetched")
  async status(@Param("transactionReferenceId") transactionReferenceId: string) {
    const data = await this.payments.status(transactionReferenceId);
    return ApiResponse.success(data, "Payment status fetched");
  }
}
