import { randomBytes, scryptSync } from "node:crypto";
const passcode = randomBytes(15).toString("base64url");
const salt = randomBytes(16).toString("hex");
console.log("Store this output privately. Never commit it.\n");
console.log(`Workspace passcode: ${passcode}\n`);
console.log(
  `AUTH_REQUIRED=true\nWORKSPACE_PASSWORD_HASH=${salt}:${scryptSync(passcode, salt, 64).toString("hex")}\nSESSION_SECRET=${randomBytes(32).toString("hex")}`,
);
