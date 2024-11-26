import { SignJWT } from "jose";

const encoder = new TextEncoder();
const accessKey = encoder.encode(Bun.env.JWT_ACCESS_SECRET);

export function getAccessToken(userId: number) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .sign(accessKey);
}

export async function getAccessCookie(userId: number): Promise<Headers> {
  return new Headers({ Cookie: `access=${await getAccessToken(userId)}` });
}
