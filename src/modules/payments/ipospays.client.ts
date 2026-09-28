import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { IposPaysConfig } from "../../config/ipospays.config.js";
import {
  assertTransactionReference,
  createTransactionReference,
  readAccessDenial,
  toMinorAmount,
} from "./ipospays.util.js";

export interface IposAuthResult {
  responseCode: string;
  responseMessage: string;
  authenticated: boolean;
}

export interface HostedPaymentInput {
  amount: number;
  transactionReferenceId?: string;
  returnUrl?: string;
  failureUrl?: string;
  cancelUrl?: string;
}

export interface HostedPaymentResult {
  environment: IposPaysConfig["env"];
  transactionReferenceId: string;
  amount: string;
  paymentUrl: string;
  responseMessage: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class IposPaysClient {
  private cache: TokenCache | null = null;

  constructor(private readonly configService: ConfigService) {}

  private settings(): IposPaysConfig {
    const config = this.configService.get<IposPaysConfig>("ipospays");
    if (!config?.apiKey || !config.secretKey || !config.tpn) {
      throw new ServiceUnavailableException(
        "iPOSpays sandbox credentials are missing. Set IPOSPAYS_ENV, IPOSPAYS_API_KEY, IPOSPAYS_SECRET_KEY, and IPOSPAYS_TPN.",
      );
    }
    return config;
  }

  async authenticate(force = false): Promise<IposAuthResult> {
    const config = this.settings();
    const token = await this.token(force);
    const url = new URL(config.paymentStatusUrl);
    url.searchParams.set("tpn", config.tpn);
    url.searchParams.set("transactionReferenceId", "PROBE0001");

    const response = await fetch(url, {
      method: "GET",
      headers: { token },
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await this.parseJson(response);
    const denial = readAccessDenial(payload);
    if (
      denial
      || response.status === 401
      || response.status === 403
      || response.status >= 500
    ) {
      return {
        responseCode: denial?.responseCode ?? String(response.status),
        responseMessage:
          denial?.responseMessage
          || messageField(payload)
          || "iPOSpays rejected these credentials for payments",
        authenticated: false,
      };
    }

    return {
      responseCode: "00",
      responseMessage: "Success",
      authenticated: true,
    };
  }

  async createHostedPayment(
    input: HostedPaymentInput,
  ): Promise<HostedPaymentResult> {
    const config = this.settings();
    const transactionReferenceId = assertTransactionReference(
      input.transactionReferenceId ?? createTransactionReference(),
    );
    const amount = toMinorAmount(input.amount);
    const token = await this.token();
    const notifyByRedirect = Boolean(input.returnUrl);

    const body = {
      merchantAuthentication: {
        merchantId: merchantId(config.tpn),
        transactionReferenceId,
      },
      transactionRequest: {
        transactionType: 1,
        amount,
        calculateFee: false,
        tipsInputPrompt: false,
        calculateTax: false,
      },
      notificationOption: {
        notifyBySMS: false,
        notifyByPOST: false,
        notifyByRedirect,
        returnUrl: input.returnUrl ?? "",
        failureUrl: input.failureUrl ?? "",
        cancelUrl: input.cancelUrl ?? "",
      },
      preferences: {
        integrationType: 1,
        avsVerification: false,
        eReceipt: false,
        eReceiptInputPrompt: false,
        requestCardToken: false,
      },
      personalization: {
        merchantName: "Sandbox",
        payNowButtonText: "Pay Now",
        cancelButtonText: "Cancel",
      },
    };

    const payload = await this.postJson(config.hostedPaymentUrl, body, {
      token,
      "content-type": "application/json",
    });

    const paymentUrl = stringField(payload, "information");
    if (!paymentUrl) {
      throw new BadGatewayException(
        messageField(payload) || "iPOSpays did not return a hosted payment URL",
      );
    }

    return {
      environment: config.env,
      transactionReferenceId,
      amount,
      paymentUrl,
      responseMessage: messageField(payload) || "Url generated Successful",
    };
  }

  async queryStatus(transactionReferenceId: string): Promise<unknown> {
    const config = this.settings();
    const reference = assertTransactionReference(transactionReferenceId);
    const token = await this.token();
    const url = new URL(config.paymentStatusUrl);
    url.searchParams.set("tpn", config.tpn);
    url.searchParams.set("transactionReferenceId", reference);

    const response = await fetch(url, {
      method: "GET",
      headers: { token },
      signal: AbortSignal.timeout(20_000),
    });
    return this.readPayload(response);
  }

  private async token(force = false): Promise<string> {
    const config = this.settings();
    const fresh =
      this.cache && this.cache.expiresAt > Date.now() + 60_000;
    if (!force && fresh && this.cache) {
      return this.cache.token;
    }

    const payload = await this.postJson(
      config.authUrl,
      undefined,
      {
        apiKey: config.apiKey,
        secretKey: config.secretKey,
        scope: config.scope,
        TokenExpiryMinutes: String(config.tokenExpiryMinutes),
      },
    );

    const responseCode = stringField(payload, "responseCode");
    const token = stringField(payload, "token");
    if (responseCode !== "00" || !token) {
      throw new BadGatewayException(
        messageField(payload) || "iPOSpays rejected the sandbox credentials",
      );
    }

    this.cache = {
      token,
      expiresAt: Date.now() + config.tokenExpiryMinutes * 60_000,
    };
    return token;
  }

  private async postJson(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    return this.readPayload(response);
  }

  private async parseJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new BadGatewayException("iPOSpays returned a non-JSON response");
    }
  }

  private async readPayload(response: Response): Promise<Record<string, unknown>> {
    const payload = await this.parseJson(response);
    if (!response.ok) {
      throw new BadGatewayException(
        messageField(payload) || `iPOSpays request failed (${response.status})`,
      );
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadGatewayException("iPOSpays returned an unexpected payload");
    }
    return payload as Record<string, unknown>;
  }
}

function merchantId(tpn: string): number | string {
  if (/^\d{12}$/.test(tpn)) return Number(tpn);
  return tpn;
}

function stringField(payload: unknown, key: string): string {
  if (!payload || typeof payload !== "object") return "";
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function messageField(payload: unknown): string {
  const direct = (
    stringField(payload, "responseMessage")
    || stringField(payload, "message")
    || stringField(payload, "errResponseMessage")
  );
  if (direct) return direct;
  if (!payload || typeof payload !== "object") return "";
  const errors = (payload as Record<string, unknown>).errors;
  if (!Array.isArray(errors) || errors.length === 0) return "";
  const first = errors[0];
  if (!first || typeof first !== "object") return "";
  const record = first as Record<string, unknown>;
  const field = typeof record.field === "string" ? record.field : "";
  const message = typeof record.message === "string" ? record.message : "";
  if (field === "MTERR_009") {
    return "This sandbox API user is not registered for PaymentTokenization. Enable that scope on the sandbox merchant key, then retry.";
  }
  if (field && message && field !== "DB Error") return `${field}: ${message}`;
  return message;
}
