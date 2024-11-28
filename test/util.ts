import { SignJWT } from "jose";

const encoder = new TextEncoder();
const accessSecret = encoder.encode(Bun.env.JWT_ACCESS_SECRET);
const refreshSecret = encoder.encode(Bun.env.JWT_REFRESH_SECRET);

export function signAccess(payload: { userId: number }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(accessSecret);
}

export function signRefresh(payload: { userId: number; refreshKey: number }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .sign(refreshSecret);
}
