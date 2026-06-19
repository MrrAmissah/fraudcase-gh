import { redactPIIAndSecrets, countSensitivePatterns as newCount } from "../security/redaction";

/**
 * Legacy wrapper for redactPII, returning the redacted text
 */
export function redactPII(text: string): string {
  return redactPIIAndSecrets(text).redactedText;
}

/**
 * Legacy wrapper for counting sensitive patterns
 */
export function countSensitivePatterns(text: string): number {
  return newCount(text);
}
