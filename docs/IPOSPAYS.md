# iPOSpays payments — sandbox, then production

**Status:** the API calls iPOSpays. `IPOSPAYS_ENV=sandbox` uses `*.ipospays.tech`. Production hosts are selected only when `IPOSPAYS_ENV=production`.

Start on the **sandbox (UAT)**. Production credentials and `*.ipospays.com` hosts stay unused until a sandbox payment can be created, queried, and refunded or voided.

Official references:

- [Authentication token](https://docs.ipospays.com/ipos-pays-authentication-token-api)
- [Hosted Payment Page](https://docs.ipospays.com/hosted-payment-page/apidocs)
- [iPOS Transact](https://docs.ipospays.com/ipos-transact/apidocs)
- Sandbox portal docs: [HPP](https://uatdocs.ipospays.tech/hosted-payment-page/apidocs), [Transact](https://uatdocs.ipospays.tech/ipos-transact/apidocs)

---

## Routes on this API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/payments/ipospays/connection` | Exchange the API key and secret for a sandbox token. The token stays on the server. |
| `POST` | `/api/v1/payments/hosted-page` | Create a Hosted Payment Page URL. Body `amount` is USD (`10.50` is sent as `1050`). Needs the access cookie and `x-csrf-token`. |
| `GET` | `/api/v1/payments/status/:transactionReferenceId` | Pull status for that reference. Needs the access cookie. |

The TPN is sent as `merchantId` on the hosted page and as `tpn` on the status query. It is not sent when requesting the auth token.

## What this server should do

The Nest API holds merchant secrets and talks to iPOSpays. Browsers never receive the API key or secret key.

Preferred first flow is the **Hosted Payment Page (HPP)**. The shopper enters card data on iPOSpays, so this server does not handle PAN data.

Use **iPOS Transact v3** when a later flow must charge, refund, void, or pre-auth from the server (token or encrypted card data). Prefer v3. v1 and v2 need a portal-generated token and are not the target.

---

## Before the first sandbox call

1. Onboard a merchant on the iPOSpays **sandbox** environment.
2. Copy that merchant’s **TPN** (12-digit `merchantId` on HPP).
3. In the sandbox portal, create an **API key** and **secret key** (Merchant Keys / Ecom token, under the sandbox TPN).
4. Put them in `.env` with `IPOSPAYS_ENV=sandbox`.
5. Keep production keys out of this file until the checklist at the bottom is done.

If there is no sandbox TPN, contact the ISO or `devsupport@dejavoo.io`.

Sandbox keys and production keys are different. A sandbox TPN will not authorize against `*.ipospays.com`.

---

## Environments

Set `IPOSPAYS_ENV` and load only that row’s hosts.

| | Sandbox (test first) | Production (after sign-off) |
|--|----------------------|-----------------------------|
| `IPOSPAYS_ENV` | `sandbox` | `production` |
| Auth token | `https://auth.ipospays.tech/v1/authenticate-token` | `https://auth.ipospays.com/v1/authenticate-token` |
| HPP v1 — create page | `https://payment.ipospays.tech/api/v1/external-payment-transaction` | `https://payment.ipospays.com/api/v1/external-payment-transaction` |
| HPP v3 — create page | `https://payment.ipospays.tech/api/v3/external-payment-transaction` | `https://payment.ipospays.com/api/v3/external-payment-transaction` |
| Payment status | `https://api.ipospays.tech/v1/queryPaymentStatus` | `https://api.ipospays.com/v1/queryPaymentStatus` |
| Transact v3 | `https://payment.ipospays.tech/api/v3/iposTransact` | `https://payment.ipospays.com/api/v3/iposTransact` |

Hosted page URLs returned by sandbox look like `https://payment.ipospays.tech/api/v1/externalPay?t=<token>`.

---

## Auth token

Every protected iPOSpays call needs a JWT from the auth host for the active environment.

```bash
curl -X POST 'https://auth.ipospays.tech/v1/authenticate-token' \
  -H 'apiKey: <sandbox-api-key>' \
  -H 'secretKey: <sandbox-secret-key>' \
  -H 'TokenExpiryMinutes: 30'
```

- Headers, not a JSON body: `apiKey`, `secretKey`, optional `TokenExpiryMinutes`.
- Expiry is an integer from **30** to **1440** minutes (24 hours).
- `200` with `responseCode` `00` returns `token`. Send that token on later calls the way the chosen API doc specifies.
- Merchant scope for payments is `PaymentTokenization` (Transact v3 and transaction status). Do not request scopes the key was not issued for.

Cache the token until shortly before `TokenExpiryMinutes`, then request a new one. Do not log the token, API key, or secret.

Production is the same request with `https://auth.ipospays.com/v1/authenticate-token` and the production key pair.

---

## Sandbox test order

1. **Token.** Confirm `responseCode` `00` against `auth.ipospays.tech`.
2. **HPP.** `POST` the sandbox external-payment-transaction URL with the sandbox TPN as `merchantId`, a unique transaction reference, amount, and redirect or callback fields from the [HPP doc](https://docs.ipospays.com/hosted-payment-page/apidocs). Open the returned `information` URL and complete a sandbox checkout.
3. **Status.** Call sandbox `queryPaymentStatus` with the same reference and confirm the approved or declined result.
4. **Refund or void** (Transact v3, or the HPP follow-up your flow uses) against that sandbox transaction.
5. Record request ids and iPOSpays response codes. Fix mapping in this API before any production key is loaded.

Use only card numbers and ACH samples published in the iPOSpays sandbox docs or portal. Do not invent PANs.

---

## Moving to production

Do this only after step 5 above passes on sandbox.

1. Email `devsupport@denovosystem.com` for **production** credentials once the sandbox integration is complete (iPOSpays asks for this in the HPP docs).
2. Onboard the live merchant and copy the **production** TPN, API key, and secret. They replace the sandbox values. They are not the same strings.
3. Set `IPOSPAYS_ENV=production`. The client must select `*.ipospays.com` hosts from the table above. There is no other code path change if hosts are derived from `IPOSPAYS_ENV`.
4. Run one low-amount live sale, a status check, and a refund or void.
5. Confirm production logs do not print secrets, full card data, or raw tokens.

`NODE_ENV=production` on this API is separate. It turns on secure cookies and rejects dev JWT secrets. It does not select the iPOSpays host. `IPOSPAYS_ENV` does.

---

## Suggested server shape (when implementing)

Keep calls in one module, for example `src/modules/payments/`, with:

- config registered from `IPOSPAYS_*` (reject startup in production if `IPOSPAYS_ENV`, keys, or TPN are missing)
- a host map keyed by `sandbox` | `production`
- token fetch + in-memory cache
- HPP create + status as the first two endpoints on this API
- Transact v3 sale / refund / void after HPP is proven

Swagger for those routes should state that the active upstream is sandbox or production based on `IPOSPAYS_ENV`, and should not echo secrets in examples.
