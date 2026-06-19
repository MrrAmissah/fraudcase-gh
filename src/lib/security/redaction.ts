/**
 * Security and Redaction Utility for protecting PII and secrets
 * before transmitting data to AI models.
 */

// REGEX PATTERNS FOR SENSITIVE DATA DETECTIONS
const PHONE_REGEX = /(?:\+?233|0)[235][0-9]\d{7}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
const GHANA_CARD_REGEX = /\bGHA-\d{9}-\d\b/gi;
const BANK_ACCOUNT_REGEX = /\b\d{10,16}\b/g;

// OTP / Token / Secrets / PIN pattern filters
const SECRET_KEY_REGEX = /(?:api(?:_)?key|client_secret|bearer|token|secret|private_key|passwd|password)\s*[:=]\s*['"]?([a-zA-Z0-9\-_]{16,})['"]?/gi;
const PIN_CODE_REGEX = /\b(?:pin|otp|passcode|validation\s+code|verification\s+code)\b\s*[:=]?\s*\b([0-9]{4,8})\b/gi;

export interface RedactionResult {
  originalText: string;
  redactedText: string;
  redactionWarnings: string[];
  detectedSensitiveTypes: string[];
}

/**
 * Redacts potential personal identifiers (PII), secret tokens, and PIN values from text blocks.
 */
export function redactPIIAndSecrets(text: string): RedactionResult {
  if (!text) {
    return {
      originalText: "",
      redactedText: "",
      redactionWarnings: [],
      detectedSensitiveTypes: [],
    };
  }

  let redacted = text;
  const warnings: string[] = [];
  const detectedTypes: string[] = [];

  // 1. Redact Ghana Card
  const ghCardMatches = text.match(GHANA_CARD_REGEX);
  if (ghCardMatches && ghCardMatches.length > 0) {
    redacted = redacted.replace(GHANA_CARD_REGEX, "[GHANA-CARD-REDACTED]");
    warnings.push(`Masked ${ghCardMatches.length} Ghana National ID card pattern(s).`);
    detectedTypes.push("ghana_card");
  }

  // 2. Redact Emails
  const emailMatches = text.match(EMAIL_REGEX);
  if (emailMatches && emailMatches.length > 0) {
    redacted = redacted.replace(EMAIL_REGEX, "[EMAIL-REDACTED]");
    warnings.push(`Masked ${emailMatches.length} email address(es).`);
    detectedTypes.push("email");
  }

  // 3. Redact Phone numbers (leaving last 3 digits for contextual validation)
  const phoneMatches = text.match(PHONE_REGEX);
  if (phoneMatches && phoneMatches.length > 0) {
    redacted = redacted.replace(PHONE_REGEX, (match) => {
      if (match.length > 6) {
        return `${match.slice(0, 4)}***${match.slice(-3)}`;
      }
      return "[PHONE-REDACTED]";
    });
    warnings.push(`Partially masked ${phoneMatches.length} phone number(s).`);
    detectedTypes.push("phone");
  }

  // 4. Redact Credit cards / Mobile Money wallets
  const cardMatches = text.match(CREDIT_CARD_REGEX);
  if (cardMatches && cardMatches.length > 0) {
    redacted = redacted.replace(CREDIT_CARD_REGEX, "[CARD/WALLET-REDACTED]");
    warnings.push(`Masked ${cardMatches.length} credit card or payment wallet sequence(s).`);
    detectedTypes.push("payment_card_or_wallet");
  }

  // 5. Redact Bank Account Numbers (longer digits sequences)
  const bankMatches = text.match(BANK_ACCOUNT_REGEX);
  const unredactedBankMatches = bankMatches?.filter(m => !cardMatches?.includes(m));
  if (unredactedBankMatches && unredactedBankMatches.length > 0) {
    redacted = redacted.replace(BANK_ACCOUNT_REGEX, "[ACCOUNT-REDACTED]");
    warnings.push(`Masked ${unredactedBankMatches.length} bank account number sequence(s).`);
    detectedTypes.push("bank_account");
  }

  // 6. Redact API keys / client secrets
  let apiKeysCount = 0;
  redacted = redacted.replace(SECRET_KEY_REGEX, (match, prefixValue) => {
    apiKeysCount++;
    // Get full match text, replace just the captured secret sequence
    return match.replace(prefixValue, "[SECRET-KEY-REDACTED]");
  });
  if (apiKeysCount > 0) {
    warnings.push(`Masked ${apiKeysCount} access key, password, or client secret value(s).`);
    detectedTypes.push("access_key_or_secret");
  }

  // 7. Redact OTP / PIN values
  let pinCount = 0;
  redacted = redacted.replace(PIN_CODE_REGEX, (match, codeValue) => {
    pinCount++;
    return match.replace(codeValue, "[OTP/PIN-REDACTED]");
  });
  if (pinCount > 0) {
    warnings.push(`Masked ${pinCount} temporary OTP/PIN validation numeric sequence(s).`);
    detectedTypes.push("pin_or_otp");
  }

  return {
    originalText: text,
    redactedText: redacted,
    redactionWarnings: warnings,
    detectedSensitiveTypes: detectedTypes,
  };
}

/**
 * Counts total potential sensitive patterns present in raw text
 */
export function countSensitivePatterns(text: string): number {
  if (!text) return 0;
  let totalCount = 0;

  const phone = text.match(PHONE_REGEX);
  if (phone) totalCount += phone.length;

  const email = text.match(EMAIL_REGEX);
  if (email) totalCount += email.length;

  const cc = text.match(CREDIT_CARD_REGEX);
  if (cc) totalCount += cc.length;

  const ghanaCard = text.match(GHANA_CARD_REGEX);
  if (ghanaCard) totalCount += ghanaCard.length;

  // Add keys / pinnings
  const apiMatches = text.match(SECRET_KEY_REGEX);
  if (apiMatches) totalCount += apiMatches.length;

  const pinMatches = text.match(PIN_CODE_REGEX);
  if (pinMatches) totalCount += pinMatches.length;

  return totalCount;
}
