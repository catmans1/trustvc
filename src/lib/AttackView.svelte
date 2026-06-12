<script lang="ts">
  import { onMount } from "svelte";
  import {
    fetchIssuedVC,
    listIssuedCredentials,
    verifyCredential,
    type Credential,
    type CredentialRecord,
    type VerificationResponse,
    type VerificationStep,
  } from "./api";
  import { attackScenarios, type AttackScenario } from "./attackScenarios";

  let history = $state<CredentialRecord[]>([]);
  let selectedId = $state<string>("");
  let sourceCredential = $state<Credential | null>(null);
  let pastedJson = $state("");
  let mode = $state<"history" | "paste">("history");

  let selectedScenario = $state<AttackScenario | null>(null);
  let mutated = $state<Credential | null>(null);
  let result = $state<VerificationResponse | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    await refreshHistory();
  });

  async function refreshHistory() {
    try {
      history = (await listIssuedCredentials()).sort((a, b) =>
        b.issuedAt.localeCompare(a.issuedAt),
      );
      if (history.length > 0 && !selectedId) {
        selectedId = history[0].id;
        await loadFromHistory();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function loadFromHistory() {
    if (!selectedId) return;
    busy = true;
    error = null;
    result = null;
    mutated = null;
    selectedScenario = null;
    try {
      sourceCredential = await fetchIssuedVC(selectedId);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function loadFromPaste() {
    error = null;
    result = null;
    mutated = null;
    selectedScenario = null;
    try {
      sourceCredential = JSON.parse(pastedJson) as Credential;
    } catch {
      error = "JSON が正しくありません";
      sourceCredential = null;
    }
  }

  async function runAttack(s: AttackScenario) {
    if (!sourceCredential) return;
    selectedScenario = s;
    busy = true;
    error = null;
    result = null;
    try {
      mutated = s.transform(sourceCredential);
      result = await verifyCredential(mutated);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function runPristine() {
    if (!sourceCredential) return;
    selectedScenario = null;
    mutated = null;
    busy = true;
    error = null;
    result = null;
    try {
      result = await verifyCredential(sourceCredential);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  function stepLabel(id: string): string {
    const map: Record<string, string> = {
      proof_verification: "署名検証",
      revocation_check: "失効状態",
    };
    return map[id] ?? id;
  }

  function stepIcon(step: VerificationStep): string {
    if (step.valid === false) return "×";
    if (step.valid === true) return "✓";
    if (step.error) return "⚠︎";
    return "·";
  }

  function stepClass(step: VerificationStep): string {
    if (step.valid === false) return "step ng";
    if (step.valid === true) return "step ok";
    if (step.error) return "step warn";
    return "step";
  }
</script>

<div class="panel">
  <h2>🎯 攻撃シナリオ</h2>
  <p class="hint">
    発行済 VC または外部 VC を選択 → 攻撃パターンを適用 → verifier の検出を確認。
  </p>

  <div class="source">
    <h3>1. ソース選択</h3>
    <div class="mode">
      <label>
        <input type="radio" bind:group={mode} value="history" />
        発行履歴から
      </label>
      <label>
        <input type="radio" bind:group={mode} value="paste" />
        JSON を貼付
      </label>
    </div>

    {#if mode === "history"}
      <div class="history">
        <select bind:value={selectedId}>
          <option value="">-- 選択 --</option>
          {#each history as rec}
            <option value={rec.id}>
              [{rec.issuedAt.slice(0, 19)}] {rec.subjectName} /
              {rec.achievementName}
              {rec.revoked ? " (失効済)" : ""}
            </option>
          {/each}
        </select>
        <button onclick={loadFromHistory} disabled={!selectedId || busy}>読み込み</button>
        <button onclick={refreshHistory} disabled={busy}>↻ 履歴更新</button>
      </div>
    {:else}
      <div class="paste">
        <textarea
          bind:value={pastedJson}
          rows="6"
          placeholder="VC JSON をここに貼付 (他の発行体の OB 3.0 VC でも可)"
        ></textarea>
        <button onclick={loadFromPaste} disabled={!pastedJson.trim()}>読み込み</button>
      </div>
    {/if}
  </div>

  {#if sourceCredential}
    <div class="loaded">
      <h3>2. ソース確認</h3>
      <div class="meta">
        <span><strong>id:</strong> <code>{String(sourceCredential.id)}</code></span>
        <span><strong>subject:</strong> {(sourceCredential.credentialSubject as any)?.name ?? "-"}</span>
        <span><strong>issuer:</strong> <code>{((sourceCredential.issuer as any)?.id ?? sourceCredential.issuer) ?? "-"}</code></span>
      </div>
      <button onclick={runPristine} disabled={busy} class="pristine">この VC を無改竄で検証</button>
    </div>

    <div class="attacks">
      <h3>3. 攻撃を選んで検証</h3>
      <ul class="attack-list">
        {#each attackScenarios as s}
          <li>
            <button
              class="attack-btn"
              class:active={selectedScenario?.id === s.id}
              onclick={() => runAttack(s)}
              disabled={busy}
            >
              {s.label}
            </button>
            <span class="attack-desc">{s.description}</span>
            <span class="attack-expected">期待: {s.expected}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if error}
    <p class="error">error: {error}</p>
  {/if}

  {#if result}
    <div class="result">
      <h3>
        検証結果
        {#if selectedScenario}
          <span class="tag">[{selectedScenario.label}]</span>
        {:else}
          <span class="tag pristine-tag">[無改竄]</span>
        {/if}
      </h3>

      {#if result.errors && result.errors.length > 0}
        <div class="fatal">
          <strong>fatal error (改竄検知):</strong>
          <ul>
            {#each result.errors as err}
              <li>[{err.name}] {err.message}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if result.log}
        <ul class="log">
          {#each result.log as step}
            <li class={stepClass(step)}>
              <span class="icon">{stepIcon(step)}</span>
              <span class="label">{stepLabel(step.id)}</span>
              {#if step.error}
                <span class="detail">— {step.error.message}</span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      {#if mutated}
        <details>
          <summary>改竄された credential (JSON)</summary>
          <pre>{JSON.stringify(mutated, null, 2)}</pre>
        </details>
      {/if}

      <details>
        <summary>verifier raw result</summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  h2 {
    margin: 0;
    font-size: 1.15rem;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: #444;
  }
  .hint {
    color: #666;
    font-size: 0.85rem;
    margin: 0;
  }
  .source,
  .loaded,
  .attacks,
  .result {
    padding: 0.75rem 1rem;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
  }
  .mode {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }
  .history,
  .paste {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .paste {
    flex-direction: column;
    align-items: stretch;
  }
  select {
    flex: 1;
    min-width: 300px;
    padding: 0.45rem 0.6rem;
    font-size: 0.9rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
  textarea {
    padding: 0.5rem;
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: vertical;
  }
  button {
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
    background: #222;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:disabled {
    background: #aaa;
    cursor: not-allowed;
  }
  button.pristine {
    background: #056;
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
    color: #444;
  }
  code {
    font-family: ui-monospace, monospace;
    background: #eee;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }
  .attack-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .attack-list li {
    display: grid;
    grid-template-columns: 160px 1fr auto;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .attack-btn {
    padding: 0.35rem 0.6rem;
    font-size: 0.85rem;
    background: #a33;
  }
  .attack-btn:hover:not(:disabled) {
    background: #822;
  }
  .attack-btn.active {
    background: #611;
    box-shadow: inset 0 0 0 2px #fcc;
  }
  .attack-desc {
    color: #533;
  }
  .attack-expected {
    color: #964;
    font-size: 0.8rem;
    font-style: italic;
    white-space: nowrap;
  }
  .fatal {
    background: #fee;
    border: 1px solid #fcc;
    padding: 0.75rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    color: #a00;
  }
  .log {
    list-style: none;
    padding: 0;
    margin: 0 0 0.5rem;
  }
  .step {
    padding: 0.4rem 0.75rem;
    margin-bottom: 0.25rem;
    border-radius: 4px;
    background: #f4f4f4;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.9rem;
  }
  .step.ok {
    background: #e6f7ee;
    color: #056;
  }
  .step.ng {
    background: #fdecea;
    color: #a00;
  }
  .step.warn {
    background: #fff4e5;
    color: #a60;
  }
  .icon {
    width: 1.25rem;
    text-align: center;
    font-weight: bold;
  }
  .detail,
  .muted {
    color: #666;
    font-size: 0.85rem;
  }
  .tag {
    font-size: 0.8rem;
    background: #a33;
    color: #fff;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    margin-left: 0.5rem;
  }
  .tag.pristine-tag {
    background: #056;
  }
  .error {
    color: #c00;
  }
  details {
    margin-top: 0.5rem;
  }
  summary {
    cursor: pointer;
    color: #666;
    font-size: 0.85rem;
  }
  pre {
    background: #f4f4f4;
    padding: 0.75rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.75rem;
    max-height: 400px;
  }
</style>
