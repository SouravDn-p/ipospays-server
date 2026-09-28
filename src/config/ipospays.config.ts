import { registerAs } from "@nestjs/config";

export type IposPaysEnvironment = "sandbox" | "production";

export interface IposPaysHosts {
  authUrl: string;
  hostedPaymentUrl: string;
  paymentStatusUrl: string;
}

export interface IposPaysConfig extends IposPaysHosts {
  env: IposPaysEnvironment;
  apiKey: string;
  secretKey: string;
  tpn: string;
  tokenExpiryMinutes: number;
}

const HOSTS: Record<IposPaysEnvironment, IposPaysHosts> = {
  sandbox: {
    authUrl: "https://auth.ipospays.tech/v1/authenticate-token",
    hostedPaymentUrl:
      "https://payment.ipospays.tech/api/v3/external-payment-transaction",
    paymentStatusUrl: "https://api.ipospays.tech/v1/queryPaymentStatus",
  },
  production: {
    authUrl: "https://auth.ipospays.com/v1/authenticate-token",
    hostedPaymentUrl:
      "https://payment.ipospays.com/api/v3/external-payment-transaction",
    paymentStatusUrl: "https://api.ipospays.com/v1/queryPaymentStatus",
  },
};

export function hostsFor(env: IposPaysEnvironment): IposPaysHosts {
  return HOSTS[env];
}

export function parseIposPaysEnvironment(
  value: string | undefined,
): IposPaysEnvironment {
  if (!value || value === "sandbox") return "sandbox";
  if (value === "production") return "production";
  throw new Error(
    `IPOSPAYS_ENV must be "sandbox" or "production" (received "${value}")`,
  );
}

export function parseTokenExpiryMinutes(value: string | undefined): number {
  const parsed = Number(value ?? 30);
  if (!Number.isInteger(parsed) || parsed < 30 || parsed > 1440) {
    throw new Error(
      "IPOSPAYS_TOKEN_EXPIRY_MINUTES must be an integer from 30 to 1440",
    );
  }
  return parsed;
}

export default registerAs<IposPaysConfig>("ipospays", (): IposPaysConfig => {
  const env = parseIposPaysEnvironment(process.env.IPOSPAYS_ENV);
  return {
    env,
    apiKey: process.env.IPOSPAYS_API_KEY?.trim() ?? "",
    secretKey: process.env.IPOSPAYS_SECRET_KEY?.trim() ?? "",
    tpn: process.env.IPOSPAYS_TPN?.trim() ?? "",
    tokenExpiryMinutes: parseTokenExpiryMinutes(
      process.env.IPOSPAYS_TOKEN_EXPIRY_MINUTES,
    ),
    ...hostsFor(env),
  };
});
