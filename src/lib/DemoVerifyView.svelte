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
  let scanResult = $state<string | null>(null);

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
    if (typeof data === "string") {
      return data;
    }
    if (data && typeof data === "object") {
      const maybe = (data as any).data;
      if (typeof maybe === "string") {
        return maybe;
      }
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
    scanResult = rawData;

    try {
      let parsed = JSON.parse(rawData);
      if (parsed && typeof parsed === "object" && typeof (parsed as any).data === "string") {
        rawData = (parsed as any).data;
        scanResult = rawData;
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
    if (step.valid === false) return "×";
    return "·";
  }

  function stepClass(step: { valid?: boolean; error?: { message: string } }): string {
    if (step.error) return "step warn";
    if (step.valid === true) return "step ok";
    if (step.valid === false) return "step ng";
    return "step";
  }
</script>

<div class="panel">
  <h2>Demo: JSON 検証</h2>
  <p class="hint">ここに発行された JSON を貼り付け、ブラウザ内で検証します。</p>

  <textarea bind:value={input} rows="14" placeholder="VC JSON をここに貼り付け" spellcheck="false" />

  <div class="actions">
    <button onclick={verify} disabled={loading || !input.trim()}>
      {loading ? "検証中..." : "検証"}
    </button>
    <button onclick={() => (scanning = !scanning)}>
      {scanning ? "停止" : "Scan QR"}
    </button>
  </div>

  {#if error}
    <p class="error">error: {error}</p>
  {/if}

  {#if scanResult}
    <div class="scan-result">
      <strong>QR scan:</strong>
      <pre>{scanResult}</pre>
    </div>
  {/if}

  {#if result}
    <div class="result">
      <h3>検証結果</h3>
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
      <details>
        <summary>raw result</summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  {/if}
  {#if scanning}
    <div style="margin-top:1rem">
      <QRScanner on:scan={handleScan} on:error={(e) => (error = String(e.detail.error))} />
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
  textarea {
    min-height: 280px;
    font-family: ui-monospace, monospace;
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
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .result {
    padding: 1rem;
    border-radius: 12px;
    background: #fff;
    border: 1px solid #ddd;
  }
  .log {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
  }
  .log li {
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #eee;
  }
  .log li:last-child {
    border-bottom: none;
  }
  .icon {
    width: 1.4rem;
    text-align: center;
  }
  .ok {
    color: #0a7;
  }
  .ng {
    color: #c00;
  }
  .warn {
    color: #d85;
  }
  .detail {
    color: #555;
  }
  .fatal {
    margin: 0.75rem 0;
    padding: 0.75rem;
    background: #fff3f0;
    border-radius: 8px;
    border: 1px solid #fcc;
  }
  .scan-result {
    padding: 0.85rem;
    border-radius: 10px;
    background: #f2f9ff;
    border: 1px solid #cce4ff;
  }
  .scan-result strong {
    display: block;
    margin-bottom: 0.5rem;
  }
  pre {
    background: #f6f8fa;
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    margin: 0;
  }
</style>
