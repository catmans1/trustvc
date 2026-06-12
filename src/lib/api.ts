export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export interface IssuerInfo {
  did: string;
  keyId: string;
  publicKeyMultibase: string;
  publicBaseUrl: string;
}

export interface IssueInput {
  recipientName: string;
  recipientId?: string;
  achievementName: string;
  achievementDescription?: string;
  issuerName?: string;
}

export type Credential = Record<string, unknown>;

export interface VerificationError {
  message: string;
  name?: string;
  details?: Record<string, unknown>;
}

export interface VerificationStep {
  id: string;
  valid?: boolean;
  error?: VerificationError;
  matchingIssuers?: unknown[];
  uncheckedRegistries?: unknown[];
}

export interface SchemaCheck {
  schema: string;
  result: { valid: boolean; errors?: Record<string, unknown>[] };
  source: string;
}

export interface AdditionalInformationEntry {
  id: string;
  results: SchemaCheck[];
}

export interface VerificationResponse {
  credential?: Credential;
  log?: VerificationStep[];
  errors?: VerificationError[];
  additionalInformation?: AdditionalInformationEntry[];
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(json.message || json.error || `HTTP ${res.status}`);
  }
  return json;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchIssuerInfo(): Promise<IssuerInfo> {
  const res = await fetch("/api/issuer");
  if (!res.ok) throw new Error(`Issuer fetch failed: ${res.status}`);
  return res.json();
}

export async function issueCredential(input: IssueInput): Promise<Credential> {
  const result = await postJson<{ credential: Credential }>("/api/issue", input);
  return result.credential;
}

export async function verifyCredential(
  credential: Credential,
): Promise<VerificationResponse> {
  return postJson<VerificationResponse>("/api/verify", { credential });
}

export async function fetchDistribution(
  format: "png" | "qr" | "pdf",
  credential: Credential,
): Promise<Blob> {
  const res = await fetch(`/api/distribution/${format}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) throw new Error(`${format} fetch failed: ${res.status}`);
  return res.blob();
}

export async function revokeCredential(id: string, revoke: boolean): Promise<void> {
  const path = `/api/credentials/${encodeURIComponent(id)}/${revoke ? "revoke" : "unrevoke"}`;
  const res = await fetch(path, { method: "POST" });
  if (!res.ok) throw new Error(`revoke failed: ${res.status}`);
}

export interface CredentialRecord {
  id: string;
  statusListIndex: number;
  revoked: boolean;
  issuedAt: string;
  subjectName: string;
  achievementName: string;
}

export async function listIssuedCredentials(): Promise<CredentialRecord[]> {
  const res = await fetch("/api/credentials");
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const { credentials } = (await res.json()) as { credentials: CredentialRecord[] };
  return credentials;
}

export async function fetchIssuedVC(id: string): Promise<Credential> {
  const res = await fetch(`/api/credentials/${encodeURIComponent(id)}/vc`);
  if (!res.ok) throw new Error(`fetch VC failed: ${res.status}`);
  return (await res.json()) as Credential;
}

// ============ Wallet ============

export async function fetchGoogleWalletUrl(credentialId: string): Promise<string> {
  const res = await fetch(`/api/credentials/${encodeURIComponent(credentialId)}/wallet/google`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, string>);
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

export async function fetchAppleWalletPkpass(credentialId: string): Promise<{ url: string; qr: string }> {
  const res = await fetch(`/api/credentials/${encodeURIComponent(credentialId)}/wallet/apple`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, string>);
    throw new Error(body.message || body.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as { url: string; qr: string };
}

// ============ OB 2.0 ============

export interface OB20Profile {
  "@context": string;
  id: string;
  type: string;
  name: string;
  url?: string;
  description?: string;
}

export interface OB20BadgeClass {
  "@context": string;
  id: string;
  type: string;
  name: string;
  description: string;
  criteria: { narrative: string };
  issuer: string;
}

export interface OB20Assertion {
  "@context": string;
  id: string;
  type: string;
  recipient: { type: string; hashed: boolean; identity: string; salt?: string };
  badge: string;
  issuedOn: string;
  verification: { type: string };
  revoked?: boolean;
  revocationReason?: string;
  narrative?: string;
}

export interface OB20IssueInput {
  recipientEmail?: string;
  recipientUrl?: string;
  recipientName?: string;
  badgeName: string;
  badgeDescription: string;
  criteriaNarrative?: string;
  issuerName?: string;
  narrative?: string;
  imageUrl?: string;
}

export interface OB20IssueResult {
  profile: OB20Profile;
  badge: OB20BadgeClass;
  assertion: OB20Assertion;
}

export interface OB20VerifyStep {
  id: string;
  label: string;
  valid: boolean;
  message?: string;
}

export interface OB20VerifyResult {
  steps: OB20VerifyStep[];
  assertion?: OB20Assertion;
  badge?: OB20BadgeClass;
  profile?: OB20Profile;
  errors?: string[];
}

export interface OB20IssuedRecord {
  assertionId: string;
  assertionUrl: string;
  badgeUrl: string;
  badgeName: string;
  recipientIdentity: string;
  issuedOn: string;
  revoked: boolean;
}

export async function ob20Issue(input: OB20IssueInput): Promise<OB20IssueResult> {
  return postJson<OB20IssueResult>("/api/2.0/issue", input);
}

export async function ob20VerifyUrl(url: string): Promise<OB20VerifyResult> {
  return postJson<OB20VerifyResult>("/api/2.0/verify", { url });
}

export async function ob20VerifyAssertion(
  assertion: OB20Assertion,
): Promise<OB20VerifyResult> {
  return postJson<OB20VerifyResult>("/api/2.0/verify", { assertion });
}

export async function ob20ListIssued(): Promise<OB20IssuedRecord[]> {
  const res = await fetch("/api/2.0/issued");
  if (!res.ok) throw new Error(`list failed: ${res.status}`);
  const { issued } = (await res.json()) as { issued: OB20IssuedRecord[] };
  return issued;
}

export async function ob20FetchBakedPng(assertionId: string): Promise<Blob> {
  const res = await fetch("/api/2.0/distribution/png", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assertionId }),
  });
  if (!res.ok) throw new Error(`png failed: ${res.status}`);
  return res.blob();
}

export async function ob20Revoke(assertionId: string, revoke: boolean, reason?: string): Promise<void> {
  const path = revoke ? "/api/2.0/revoke" : "/api/2.0/unrevoke";
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assertionId, ...(reason ? { reason } : {}) }),
  });
  if (!res.ok) throw new Error(`revoke failed: ${res.status}`);
}
