// CONSTANTS
const kSensitivePaths = [
  /^\.env(\..*)?$/i,
  /\.(pem|key|p12|pfx|crt|cer|der|pkcs8|pkcs12)$/i,
  /^(id_rsa|id_ed25519|id_ecdsa|id_dsa)(\.pub)?$/i,
  /secret/i,
  /password/i,
  /credential/i,
  /private[-_.]?key/i
];

const kSensitiveContentPatterns = [
  /[A-Z0-9_]*(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY|ACCESS_KEY|AWS_SECRET)[A-Z0-9_]*\s*=/im,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

export interface SensitiveFileWarning {
  type: "path" | "content";
  message: string;
}

export function checkSensitivePath(filePath: string): SensitiveFileWarning | null {
  const basename = filePath.split("/").pop() ?? filePath;

  for (const pattern of kSensitivePaths) {
    if (pattern.test(basename)) {
      return {
        type: "path",
        message: `"${basename}" looks like a sensitive file. Make sure you're not committing secrets.`
      };
    }
  }

  return null;
}

export function checkSensitiveContent(content: string): SensitiveFileWarning | null {
  for (const pattern of kSensitiveContentPatterns) {
    if (pattern.test(content)) {
      return {
        type: "content",
        message: "The file content appears to contain secrets or credentials. Are you sure?"
      };
    }
  }

  return null;
}
