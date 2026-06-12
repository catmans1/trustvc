<script lang="ts">
  import {
    verifyCredential,
    type Credential,
    type VerificationResponse,
    type VerificationStep,
  } from "./api";

  interface Props {
    initialCredential: Credential | null;
  }

  let { initialCredential }: Props = $props();

  let input = $state("");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let result = $state<VerificationResponse | null>(null);

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
      result = await verifyCredential(parsed);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function stepLabel(id: string): string {
    const map: Record<string, string> = {
      valid_signature: "署名検証",
      expiration: "有効期限",
      revocation_status: "失効状態",
      registered_issuer: "登録発行者",
    };
    return map[id] ?? id;
  }

  function stepIcon(step: VerificationStep): string {
    if (step.error) return "⚠︎";
    if (step.valid === true) return "✓";
    if (step.valid === false) return "×";
    return "·";
  }

  function stepClass(step: VerificationStep): string {
    if (step.error) return "step warn";
    if (step.valid === true) return "step ok";
    if (step.valid === false) return "step ng";
    return "step";
  }
</script>

<div class="panel">
  <h2>Credential 検証</h2>
  <p class="hint">
    発行タブで作成した VC (または外部の OB 3.0 VC JSON) を貼り付けて検証
  </p>

  <details class="guide">
    <summary>🎯 改竄・攻撃シナリオの試し方</summary>
    <div class="guide-body">
      <p>
        検知される改竄は JSON-LD canonicalization + ECDSA P-256 署名に依存。
        <strong>credentialSubject, achievement, issuer, validFrom, @context, proof</strong>
        のどこを書き換えても署名検証が落ちます (ecdsa-sd-2023 の正しい挙動)。
      </p>
      <ul>
        <li>
          <strong>発行タブの「🎯 攻撃シナリオ」ボタン群</strong> — 改竄済み
          credential を自動生成してこの画面に流す (subject改竄 / proof改竄 /
          Issuerなりすまし / 期限改竄 / context削除 など)
        </li>
        <li>
          <strong>このテキストエリアを直接編集</strong> — JSON の好きな
          field を書き換えて「検証」を押せば改竄検証。署名検証 × になるはず
        </li>
        <li>
          <strong>失効シナリオ</strong> — 発行タブの「失効」ボタン → StatusList
          の bit が立つ → このタブで検証すると「失効状態 ×」
        </li>
        <li>
          <strong>期限切れシナリオ</strong> — validFrom を未来日付に書き換え
          (署名検証も同時に × になるのは上記と同じ理由。
          純粋な期限切れを試すには issuer 側で validUntil を過去にした VC
          を作る必要あり)
        </li>
      </ul>
      <p class="meta">
        主要な攻撃カテゴリ: 改竄 / 署名偽造 / Issuer なりすまし / 失効後利用 /
        期限切れ / replay / context 詐称。
        did:web DID Document + ecdsa-sd-2023 で検出する。
        DID 解決は <code>/.well-known/did.json</code> 経由 (HTTPS)。
      </p>
    </div>
  </details>

  <textarea bind:value={input} rows="14" placeholder="VC JSON をここに貼り付け" spellcheck="false"></textarea>

  <div class="actions">
    <button onclick={verify} disabled={loading || !input.trim()}>
      {loading ? "検証中..." : "検証"}
    </button>
  </div>

  {#if error}
    <p class="error">error: {error}</p>
  {/if}

  {#if result}
    <div class="result">
      <h3>検証結果</h3>

      {#if result.errors && result.errors.length > 0}
        <div class="fatal">
          <strong>fatal error:</strong>
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

      {#if result.additionalInformation}
        <h4>Schema 検証</h4>
        {#each result.additionalInformation as info}
          {#each info.results as check}
            <div class="schema" class:ng={!check.result.valid}>
              <div class="schema-head">
                {check.result.valid ? "✓" : "×"}
                <code>{check.schema.split("/").pop()}</code>
              </div>
              <div class="schema-source">{check.source}</div>
              {#if check.result.errors && check.result.errors.length > 0}
                <ul class="schema-errors">
                  {#each check.result.errors as err}
                    <li>
                      <code>{err.instancePath || "/"}</code> {err.message}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/each}
        {/each}
      {/if}

      <details>
        <summary>raw result (JSON)</summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
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
    color: #666;
    font-size: 0.85rem;
    margin: 0 0 0.25rem;
  }
  textarea {
    padding: 0.5rem;
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    resize: vertical;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  button {
    padding: 0.5rem 1rem;
    font-size: 0.95rem;
    background: #222;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:disabled {
    background: #999;
    cursor: not-allowed;
  }
  .error {
    color: #c00;
  }
  .result {
    margin-top: 1rem;
  }
  h3 {
    font-size: 1rem;
    margin: 0 0 0.5rem;
  }
  h4 {
    font-size: 0.95rem;
    margin: 1rem 0 0.5rem;
  }
  .fatal {
    background: #fee;
    border: 1px solid #fcc;
    padding: 0.75rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }
  .log {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .step {
    padding: 0.4rem 0.75rem;
    margin-bottom: 0.25rem;
    border-radius: 4px;
    background: #f4f4f4;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.95rem;
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
  .schema {
    background: #f4f4f4;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  .schema.ng {
    background: #fff4e5;
  }
  .schema-head {
    font-size: 0.95rem;
  }
  .schema-source {
    font-size: 0.8rem;
    color: #666;
    margin-top: 0.15rem;
  }
  .schema-errors {
    margin: 0.5rem 0 0;
    font-size: 0.85rem;
  }
  code {
    font-family: ui-monospace, monospace;
    background: #eee;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
  }
  details {
    margin-top: 1rem;
  }
  summary {
    cursor: pointer;
    color: #666;
    font-size: 0.85rem;
  }
  pre {
    background: #f4f4f4;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.75rem;
    max-height: 400px;
  }
  .guide {
    background: #fffaf0;
    border: 1px solid #f0c890;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }
  .guide summary {
    cursor: pointer;
    font-weight: 600;
    color: #853;
    font-size: 0.9rem;
  }
  .guide-body {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    color: #533;
  }
  .guide-body p {
    margin: 0.25rem 0;
  }
  .guide-body ul {
    margin: 0.5rem 0;
    padding-left: 1.25rem;
  }
  .guide-body li {
    margin-bottom: 0.35rem;
  }
  .guide-body .meta {
    font-size: 0.78rem;
    color: #755;
    border-top: 1px dashed #e0b080;
    padding-top: 0.4rem;
    margin-top: 0.5rem;
  }
</style>
