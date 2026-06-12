<script lang="ts">
  import { verifyDemoCredential } from "./demo";
  import type { Credential, VerificationResponse } from "./api";
  import QRScanner from "./QRScanner.svelte";

  interface Props {
    initialCredential: Credential | null;
  }

  let { initialCredential }: Props = $props();

  let input = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let result = $state<VerificationResponse | null>(null);
  let scanning = $state(false);

  $effect(() => {
    if (initialCredential) {
      input = JSON.stringify(initialCredential, null, 2);
      result = null;
      error = null;
    }
  });

  async function verify() {
    loading = true;
    error = null;
    result = null;
    let parsed: Credential;
    try {
      parsed = JSON.parse(input);
    } catch {
      error = "JSON が正しくありません";
      loading = false;
      return;
    }
    try {
      result = await verifyDemoCredential(parsed);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function normalizeScanData(data: unknown): string {
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const maybe = (data as Record<string, unknown>).data;
      if (typeof maybe === "string") return maybe;
      try {
        return JSON.stringify(data, null, 2);
      } catch {
        return String(data);
      }
    }
    return String(data);
  }

  function handleScan(e: CustomEvent) {
    let rawData = normalizeScanData(e.detail.data);
    try {
      let parsed = JSON.parse(rawData);
      if (parsed && typeof parsed === "object" && typeof (parsed as Record<string, unknown>).data === "string") {
        rawData = (parsed as Record<string, unknown>).data as string;
        parsed = JSON.parse(rawData);
      }
      input = JSON.stringify(parsed, null, 2);
      verify();
    } catch {
      input = rawData;
    }
    scanning = false;
  }

  function stepLabel(id: string): string {
    const map: Record<string, string> = {
      valid_signature: "署名検証",
      expiration: "有効期限",
      revocation_status: "失効状態",
      registered_issuer: "登録発行者",
      schema: "スキーマ検証",
    };
    return map[id] ?? id;
  }

  function stepIcon(step: { valid?: boolean; error?: { message: string } }): string {
    if (step.error) return "⚠︎";
    if (step.valid === true) return "✓";
    if (step.valid === false) return "✗";
    return "·";
  }

  function stepClass(step: { valid?: boolean; error?: { message: string } }): string {
    if (step.error) return "step warn";
    if (step.valid === true) return "step ok";
    if (step.valid === false) return "step ng";
    return "step";
  }

  function isValid(r: VerificationResponse): boolean {
    return !r.errors?.length;
  }

  function credField(c: Credential | undefined, key: string): string {
    if (!c) return "";
    const v = c[key];
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const rec = v as Record<string, unknown>;
      return typeof rec.name === "string" ? rec.name : "";
    }
    return "";
  }

  function recipientName(r: VerificationResponse): string {
    const subj = r.credential?.credentialSubject as Record<string, unknown> | undefined;
    return typeof subj?.name === "string" ? subj.name : "";
  }

  function achievementName(r: VerificationResponse): string {
    const ach = r.credential?.achievement as Record<string, unknown> | undefined;
    return typeof ach?.name === "string" ? ach.name : "";
  }

  function issuerName(r: VerificationResponse): string {
    return credField(r.credential, "issuer");
  }
</script>

<div class="panel">
  <h2>検証デモ</h2>

  <!-- QR scan as primary entry point -->
  <button class="scan-btn" onclick={() => (scanning = !scanning)}>
    <span class="scan-icon">📷</span>
    {scanning ? "スキャン停止" : "QR コードをスキャン"}
  </button>

  {#if scanning}
    <div class="scanner-wrap">
      <QRScanner on:scan={handleScan} on:error={(e) => (error = String(e.detail.error))} />
    </div>
  {/if}

  <div class="divider"><span>または JSON を貼り付け</span></div>

  <textarea bind:value={input} rows="10" placeholder="VC JSON をここに貼り付け" spellcheck="false" />

  <div class="actions">
    <button onclick={verify} disabled={loading || !input.trim()}>
      {loading ? "検証中..." : "検証"}
    </button>
    {#if input.trim()}
      <button class="ghost" onclick={() => { input = ""; result = null; error = null; }}>クリア</button>
    {/if}
  </div>

  {#if error}
    <p class="error">error: {error}</p>
  {/if}

  {#if result}
    <!-- Big VALID / INVALID banner -->
    <div class="verdict {isValid(result) ? 'verdict-valid' : 'verdict-invalid'}">
      <span class="verdict-icon">{isValid(result) ? "✓" : "✗"}</span>
      <span class="verdict-text">{isValid(result) ? "VALID" : "INVALID"}</span>
    </div>

    <!-- Decoded credential info -->
    {#if isValid(result) && (recipientName(result) || achievementName(result))}
      <div class="decoded-info">
        {#if recipientName(result)}
          <div class="decoded-row">
            <span class="decoded-key">発行先</span>
            <span class="decoded-val">{recipientName(result)}</span>
          </div>
        {/if}
        {#if achievementName(result)}
          <div class="decoded-row">
            <span class="decoded-key">Achievement</span>
            <span class="decoded-val">{achievementName(result)}</span>
          </div>
        {/if}
        {#if issuerName(result)}
          <div class="decoded-row">
            <span class="decoded-key">発行者</span>
            <span class="decoded-val">{issuerName(result)}</span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Verification steps -->
    <div class="steps-card">
      <div class="steps-title">検証ステップ</div>
      <ul class="log">
        {#each result.log ?? [] as step}
          <li class={stepClass(step)}>
            <span class="icon">{stepIcon(step)}</span>
            <span class="label">{stepLabel(step.id)}</span>
            {#if step.error}
              <span class="detail">— {step.error.message}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>

    {#if result.errors?.length}
      <div class="fatal">
        <strong>検証エラー:</strong>
        <ul>
          {#each result.errors as err}
            <li>{err.message}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <details class="json-details">
      <summary>raw result を表示</summary>
      <pre>{JSON.stringify(result, null, 2)}</pre>
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

  /* QR scan primary button */
  .scan-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.85rem 1.5rem;
    background: #1a1a2e;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    width: 100%;
  }
  .scan-btn:hover {
    background: #16213e;
  }
  .scan-icon {
    font-size: 1.2rem;
  }
  .scanner-wrap {
    border-radius: 10px;
    overflow: hidden;
    border: 2px solid #1a1a2e;
  }

  /* Divider */
  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #aaa;
    font-size: 0.82rem;
  }
  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #ddd;
  }

  textarea {
    min-height: 220px;
    font-family: ui-monospace, monospace;
    font-size: 0.82rem;
    padding: 0.55rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    resize: vertical;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
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

  /* VALID / INVALID banner */
  .verdict {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-radius: 14px;
    font-weight: 800;
  }
  .verdict-valid {
    background: #e6f9ef;
    border: 2px solid #2ecc71;
    color: #0f7a3c;
  }
  .verdict-invalid {
    background: #fff0f0;
    border: 2px solid #e74c3c;
    color: #b01010;
  }
  .verdict-icon {
    font-size: 2rem;
    line-height: 1;
  }
  .verdict-text {
    font-size: 1.8rem;
    letter-spacing: 0.05em;
  }

  /* Decoded info */
  .decoded-info {
    background: #f0f7ff;
    border: 1px solid #b8d6ff;
    border-radius: 10px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .decoded-row {
    display: flex;
    gap: 0.75rem;
    font-size: 0.9rem;
    align-items: baseline;
  }
  .decoded-key {
    color: #5a7fa0;
    font-size: 0.78rem;
    font-weight: 600;
    min-width: 5.5rem;
    letter-spacing: 0.03em;
  }
  .decoded-val {
    color: #1a1a1a;
    font-weight: 500;
  }

  /* Steps card */
  .steps-card {
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
  }
  .steps-title {
    padding: 0.5rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: #666;
    background: #f8f8f8;
    border-bottom: 1px solid #e0e0e0;
  }
  .log {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .log li {
    display: flex;
    gap: 0.75rem;
    padding: 0.55rem 0.85rem;
    border-bottom: 1px solid #eee;
    font-size: 0.9rem;
  }
  .log li:last-child {
    border-bottom: none;
  }
  .icon {
    width: 1.4rem;
    text-align: center;
    font-weight: 700;
  }
  .ok .icon { color: #0a7; }
  .ng .icon { color: #c00; }
  .warn .icon { color: #d85; }
  .detail {
    color: #888;
    font-size: 0.85rem;
  }

  .fatal {
    padding: 0.75rem 1rem;
    background: #fff3f0;
    border-radius: 8px;
    border: 1px solid #fcc;
    font-size: 0.9rem;
  }
  .fatal ul {
    margin: 0.4rem 0 0;
    padding-left: 1.25rem;
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
    font-size: 0.82rem;
    color: #888;
    background: #f8f8f8;
    user-select: none;
  }
  .json-details summary:hover {
    background: #f0f0f0;
  }
  pre {
    background: #f6f8fa;
    padding: 1rem;
    border-radius: 0;
    overflow-x: auto;
    margin: 0;
    font-size: 0.8rem;
  }
  .error {
    color: #c00;
    font-size: 0.9rem;
    margin: 0;
  }
</style>
