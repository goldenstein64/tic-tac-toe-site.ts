import { randomBytes } from "node:crypto";

const envFile = Bun.file(".env.local");
let envText = await envFile.text();

const secrets = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;

for (const secret of secrets) {
  const reSecret = RegExp.escape(secret);
  const re = new RegExp(`^${reSecret}=.+$`, "m");
  const bytes = randomBytes(32);
  if (re.test(envText)) {
    envText = envText.replace(re, `${secret}="${bytes.toBase64()}"`);
  } else {
    // append it to the end of the file
    envText += `\n${secret}="${bytes.toBase64()}"`;
  }
}
