import { Module } from "@nestjs/common";
import { IposPaysClient } from "./ipospays.client.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";

@Module({
  controllers: [PaymentsController],
  providers: [IposPaysClient, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
