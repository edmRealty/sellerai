import crypto from "crypto";

const DEFAULT_SECRET = "sellerai-consumer-notice";
const SECRET = process.env.ESIGN_SECRET || process.env.NEXTAUTH_SECRET || DEFAULT_SECRET;

export type ConsumerNoticeTokenPayload = {
  name: string;
  email: string;
  address: string;
  listingId?: string;
  issuedAt: number;
  exp: number;
};

const toBase64Url = (input: string) =>
  Buffer.from(input, "utf8").toString("base64url");

const fromBase64Url = (input: string) =>
  Buffer.from(input, "base64url").toString("utf8");

export const signConsumerNoticeToken = (payload: ConsumerNoticeTokenPayload) => {
  const data = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
};

export const verifyConsumerNoticeToken = (token: string) => {
  if (!token || !token.includes(".")) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(fromBase64Url(data)) as ConsumerNoticeTokenPayload;
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};
