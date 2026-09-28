import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IposPaysConfig } from "../../config/ipospays.config.js";
import { CreateHostedPaymentDto } from "./dto/create-hosted-payment.dto.js";
import { IposPaysClient } from "./ipospays.client.js";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly client: IposPaysClient,
    private readonly configService: ConfigService,
  ) {}

  async connection() {
    const config = this.configService.get<IposPaysConfig>("ipospays");
    const auth = await this.client.authenticate(true);
    return {
      environment: config?.env ?? "sandbox",
      authenticated: auth.authenticated,
      responseCode: auth.responseCode,
      responseMessage: auth.responseMessage,
      tpnConfigured: Boolean(config?.tpn),
    };
  }

  createHostedPayment(dto: CreateHostedPaymentDto) {
    return this.client.createHostedPayment(dto);
  }

  status(transactionReferenceId: string) {
    return this.client.queryStatus(transactionReferenceId);
  }
}
