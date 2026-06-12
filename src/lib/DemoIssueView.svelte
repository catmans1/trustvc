<script lang="ts">
  import { issueDemoCredential } from "./demo";
  import type { Credential } from "./api";

  interface Props {
    onVerify: (credential: Credential) => void;
  }

  let { onVerify }: Props = $props();

  let recipientName = $state("タカ");
  let recipientId = $state("");
  let achievementName = $state("OB 3.0 Credential");
  let achievementDescription = $state("");
  let issuerName = $state("WisdomCerts Issuer");

  let loading = $state(false);
  let error = $state<string | null>(null);
  let credential = $state<Credential | null>(null);
  let qrDataUrl = $state<string | null>(null);
  let copyFeedback = $state(false);
  let invalidProof = $state(false);

  async function issue() {
    loading = true;
    error = null;
    credential = null;
    qrDataUrl = null;
    try {
      const result = await issueDemoCredential({
        recipientName,
        recipientId: recipientId || undefined,
        achievementName,
        achievementDescription,
        issuerName,
        invalidProof,
      });
      credential = result.credential;
      qrDataUrl = result.qr;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function copyJson() {
    if (!credential) return;
    await navigator.clipboard.writeText(JSON.stringify(credential, null, 2));
    copyFeedback = true;
    setTimeout(() => (copyFeedback = false), 2000);
  }

  function downloadJson() {
    if (!credential) return;
    const blob = new Blob([JSON.stringify(credential, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "demo-credential.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function credSubject(c: Credential) {
    return c.credentialSubject as Record<string, unknown> | undefined;
  }

  function credAchievement(c: Credential) {
    return c.achievement as Record<string, unknown> | undefined;
  }

  function formatDate(iso: unknown): string {
    if (typeof iso !== "string") return "";
    return new Date(iso).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
</script>

<div class="panel">
  <h2>発行デモ</h2>

  <label>
    受信者名
    <input bind:value={recipientName} placeholder="山田太郎" />
  </label>

  <label>
    受信者 ID <span class="optional">(任意)</span>
    <input bind:value={recipientId} placeholder="did:example:alice" />
  </label>

  <label>
    Achievement 名
    <input bind:value={achievementName} placeholder="修了証書の名前" />
  </label>

  <label>
    Achievement 説明 <span class="optional">(任意)</span>
    <textarea bind:value={achievementDescription} rows="2" placeholder="Achievement の詳細説明" />
  </label>

  <label>
    発行者名
    <input bind:value={issuerName} placeholder="組織名" />
  </label>

  <label class="checkbox-label" class:tamper-active={invalidProof}>
    <input type="checkbox" bind:checked={invalidProof} />
    <span>Proof 無効 <span class="optional">(検証で INVALID になります)</span></span>
  </label>

  <div class="actions">
    <button onclick={issue} disabled={loading || !recipientName || !achievementName}>
      {loading ? "生成中..." : "生成"}
    </button>
  </div>

  {#if error}
    <p class="error">error: {error}</p>
  {/if}

  {#if credential}
    <!-- Credential Card -->
    <div class="cert-card">
      <div class="cert-header">
        <span class="cert-label">Achievement Certificate</span>
      </div>
      <div class="cert-name">{credSubject(credential)?.name ?? ""}</div>
      <div class="cert-achievement">{credAchievement(credential)?.name ?? ""}</div>
      {#if credAchievement(credential)?.description}
        <div class="cert-desc">{credAchievement(credential)?.description}</div>
      {/if}
      <div class="cert-footer">
        <span>発行者: {typeof credential.issuer === "string" ? credential.issuer : ""}</span>
        <span>{formatDate(credential.issuanceDate)}</span>
      </div>
    </div>

    <!-- QR Code -->
    {#if qrDataUrl}
      <div class="qr-section">
        <div class="qr-label">QR コード</div>
        <img src={qrDataUrl} alt="QR Code" width="240" height="240" />
        <p class="qr-hint">検証タブで QR をスキャンできます</p>
      </div>
    {/if}

    <!-- Primary action -->
    <button class="verify-btn" onclick={() => onVerify(credential!)}>
      → この Credential を検証する
    </button>

    <!-- Secondary actions -->
    <div class="actions secondary">
      <button class="ghost" onclick={copyJson}>
        {copyFeedback ? "コピー完了 ✓" : "JSON コピー"}
      </button>
      <button class="ghost" onclick={downloadJson}>JSON ダウンロード</button>
    </div>

    <!-- Raw JSON collapsible -->
    <details class="json-details">
      <summary>JSON 詳細を表示</summary>
      <pre>{JSON.stringify(credential, null, 2)}</pre>
    </details>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  .optional {
    color: #999;
    font-size: 0.8rem;
    font-weight: normal;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  input:not([type="checkbox"]),
  textarea {
    font-family: inherit;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .checkbox-label {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    background: #fafafa;
  }
  .checkbox-label.tamper-active {
    border-color: #e74c3c;
    background: #fff5f5;
    color: #c0392b;
  }
  .checkbox-label input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
    padding: 0;
    border: none;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .secondary {
    margin-top: -0.25rem;
  }
  button {
    padding: 0.55rem 1rem;
    border: none;
    border-radius: 6px;
    background: #2a6fff;
    color: white;
    cursor: pointer;
    font-size: 0.9rem;
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  button.ghost {
    background: transparent;
    color: #555;
    border: 1px solid #ccc;
  }
  button.ghost:hover {
    background: #f5f5f5;
  }

  /* Credential card */
  .cert-card {
    border: 2px solid #e8c84a;
    border-radius: 14px;
    background: linear-gradient(135deg, #fffdf0 0%, #fff8d6 100%);
    padding: 1.5rem 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-shadow: 0 2px 12px rgba(200, 160, 0, 0.12);
  }
  .cert-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #8a6a00;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .cert-name {
    font-size: 1.8rem;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1.2;
  }
  .cert-achievement {
    font-size: 1.1rem;
    color: #333;
    font-weight: 500;
  }
  .cert-desc {
    font-size: 0.88rem;
    color: #666;
    line-height: 1.5;
  }
  .cert-footer {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
    color: #8a6a00;
    margin-top: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e8c84a66;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  /* QR section */
  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
  }
  .qr-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #444;
  }
  .qr-hint {
    font-size: 0.8rem;
    color: #888;
    margin: 0;
  }

  /* Verify button */
  .verify-btn {
    padding: 0.75rem 1.5rem;
    background: #1a8a4a;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    width: 100%;
  }
  .verify-btn:hover {
    background: #16793f;
  }

  /* JSON details */
  .json-details {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
  }
  .json-details summary {
    padding: 0.6rem 0.85rem;
    cursor: pointer;
    font-size: 0.85rem;
    color: #666;
    background: #f8f8f8;
    user-select: none;
  }
  .json-details summary:hover {
    background: #f0f0f0;
  }
  pre {
    background: #f6f8fa;
    padding: 1rem;
    overflow-x: auto;
    margin: 0;
    font-size: 0.82rem;
  }
  .error {
    color: #c00;
  }
</style>
