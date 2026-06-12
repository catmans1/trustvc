import QRCode from "qrcode";
import type {
  Credential,
  IssueInput,
  VerificationResponse,
  VerificationStep,
} from "./api";

const DEFAULT_DID = "did:example:wisdomcerts";
const DEFAULT_ISSUER_NAME = "WisdomCerts Demo Issuer";

function makeCredentialId(recipientId?: string): string {
  return recipientId
    ? `${recipientId.replace(/\s+/g, "_")}/credential/${crypto.randomUUID()}`
    : `urn:uuid:${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function issueDemoCredential(input: IssueInput): Promise<{
  credential: Credential;
  qr: string;
}> {
  const id = makeCredentialId(input.recipientId);
  const credential: Credential = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/openbadges/v3",
    ],
    id,
    type: ["VerifiableCredential", "AchievementCredential"],
    issuer: input.issuerName ? input.issuerName : DEFAULT_DID,
    issuanceDate: nowIso(),
    credentialSubject: {
      id: input.recipientId ? input.recipientId : `urn:uuid:${crypto.randomUUID()}`,
      name: input.recipientName,
    },
    achievement: {
      name: input.achievementName,
      description: input.achievementDescription || "",
    },
    proof: {
      type: "DemoProof",
      created: nowIso(),
      proofPurpose: "assertionMethod",
      verificationMethod: `${DEFAULT_DID}#key-1`,
      jws: "demo-signature",
    },
  };

  const json = JSON.stringify(credential, null, 2);
  const qr = await QRCode.toDataURL(json, {
    margin: 1,
    scale: 6,
    errorCorrectionLevel: "M",
  });

  return { credential, qr };
}

export async function verifyDemoCredential(
  credential: Credential,
): Promise<VerificationResponse> {
  const errors: { message: string; name?: string }[] = [];
  const log: VerificationStep[] = [];

  const schemaValid =
    Array.isArray(credential["@context"]) &&
    credential["@context"].includes("https://www.w3.org/2018/credentials/v1") &&
    Array.isArray(credential.type) &&
    credential.type.includes("VerifiableCredential") &&
    typeof credential.issuer === "string" &&
    typeof credential.issuanceDate === "string" &&
    credential.credentialSubject &&
    typeof (credential.credentialSubject as any).id === "string";

  log.push({
    id: "schema",
    valid: schemaValid,
  });
  if (!schemaValid) {
    errors.push({ message: "VC schema が不足しています", name: "schema" });
  }

  const proof = credential.proof as Record<string, unknown> | undefined;
  const signatureValid =
    proof !== undefined &&
    proof.type === "DemoProof" &&
    typeof proof.jws === "string";
  log.push({
    id: "valid_signature",
    valid: signatureValid,
  });
  if (!signatureValid) {
    errors.push({ message: "Proof が missing または demo 署名形式ではありません", name: "signature" });
  }

  const issuerValid = typeof credential.issuer === "string";
  log.push({
    id: "registered_issuer",
    valid: issuerValid,
  });
  if (!issuerValid) {
    errors.push({ message: "issuer の形式が正しくありません", name: "issuer" });
  }

  if (typeof credential.expirationDate === "string") {
    const expiration = Date.parse(credential.expirationDate);
    const now = Date.now();
    const expirationValid = !Number.isNaN(expiration) && expiration > now;
    log.push({
      id: "expiration",
      valid: expirationValid,
    });
    if (!expirationValid) {
      errors.push({ message: "credential は期限切れです", name: "expiration" });
    }
  }

  return {
    credential,
    log,
    errors: errors.length ? errors : undefined,
  };
}
