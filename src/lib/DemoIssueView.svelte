<script lang="ts">
  import { issueDemoCredential } from "./demo";
  import type { Credential } from "./api";

  interface Props {
    onVerify: (credential: Credential) => void;
  }

  let { onVerify }: Props = $props();

  let recipientName = $state("タカ");
  let recipientId = $state("");
  let achievementName = $state("OB 3.0 Demo Credential");
  let achievementDescription = $state("This credential was generated locally in the browser.");
  let issuerName = $state("WisdomCerts Demo Issuer");

  let loading = $state(false);
  let error = $state<string | null>(null);
  let credential = $state<Credential | null>(null);
  let qrDataUrl = $state<string | null>(null);

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
      });
      credential = result.credential;
      qrDataUrl = result.qr;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function copyJson() {
    if (!credential) return;
    navigator.clipboard.writeText(JSON.stringify(credential, null, 2));
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
</script>

<div class="panel">
  <h2>Demo: JSON / QR 生成</h2>

  <label>
    受信者名
    <input bind:value={recipientName} placeholder="山田太郎" />
  </label>

  <label>
    受信者 ID (任意)
    <input bind:value={recipientId} placeholder="did:example:alice" />
  </label>

  <label>
    Achievement 名
    <input bind:value={achievementName} placeholder="修了証書の名前" />
  </label>

  <label>
    Achievement 説明
    <textarea bind:value={achievementDescription} rows="2" />
  </label>

  <label>
    発行者名
    <input bind:value={issuerName} placeholder="組織名" />
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
    <div class="result">
      <h3>生成結果</h3>
      <div class="actions">
        <button onclick={() => onVerify(credential)}>→ この JSON を検証</button>
        <button onclick={copyJson}>JSON コピー</button>
        <button onclick={downloadJson}>JSON ダウンロード</button>
      </div>

      {#if qrDataUrl}
        <div class="qr-preview">
          <p>QR コード (credential JSON をエンコード)</p>
          <img src={qrDataUrl} alt="QR Code" width="280" height="280" />
          <p class="muted">この QR はデモ表示用です。</p>
        </div>
      {/if}

      <pre>{JSON.stringify(credential, null, 2)}</pre>
    </div>
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
  .hint {
    color: #555;
    font-size: 0.9rem;
    margin: 0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  input,
  textarea {
    font-family: inherit;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  button {
    padding: 0.55rem 1rem;
    border: none;
    border-radius: 6px;
    background: #2a6fff;
    color: white;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .result {
    padding: 1rem;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 10px;
  }
  .error {
    color: #c00;
  }
  .qr-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  pre {
    background: #f6f8fa;
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    margin: 0;
  }
</style>
