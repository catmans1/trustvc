<script lang="ts">
  import { onMount } from "svelte";
  import {
    ob20FetchBakedPng,
    ob20Issue,
    ob20ListIssued,
    ob20Revoke,
    ob20VerifyUrl,
    type OB20IssueResult,
    type OB20IssuedRecord,
    type OB20VerifyResult,
    type OB20VerifyStep,
  } from "./api";

  type Sub = "issue" | "verify";

  let sub = $state<Sub>("issue");

  // Issue form
  let recipientEmail = $state("alice@example.com");
  let badgeName = $state("OB 2.0 Hosted PoC");
  let badgeDescription = $state("Node/TS による OB 2.0 hosted assertion の実証");
  let criteriaNarrative = $state("コース完了、またはそれに準ずる条件を満たすこと");
  let issuerName = $state("WisdomCerts OB 2.0");
  let narrative = $state("");
  let imageUrl = $state("");

  let issueLoading = $state(false);
  let issueError = $state<string | null>(null);
  let issued = $state<OB20IssueResult | null>(null);

  // History
  let history = $state<OB20IssuedRecord[]>([]);

  // Verify
  let verifyUrl = $state("");
  let verifyLoading = $state(false);
  let verifyError = $state<string | null>(null);
  let verifyResult = $state<OB20VerifyResult | null>(null);

  // Revoke UI state
  let revoking = $state(false);
  let revokeMessage = $state<string | null>(null);

  onMount(async () => {
    await refreshHistory();
  });

  async function refreshHistory() {
    try {
      history = (await ob20ListIssued()).sort((a, b) =>
        b.issuedOn.localeCompare(a.issuedOn),
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function doIssue() {
    issueLoading = true;
    issueError = null;
    issued = null;
    try {
      issued = await ob20Issue({
        recipientEmail: recipientEmail || undefined,
        badgeName,
        badgeDescription,
        criteriaNarrative: criteriaNarrative || undefined,
        issuerName: issuerName || undefined,
        narrative: narrative || undefined,
        imageUrl: imageUrl || undefined,
      });
      await refreshHistory();
    } catch (e) {
      issueError = e instanceof Error ? e.message : String(e);
    } finally {
      issueLoading = false;
    }
  }

  async function doVerify() {
    if (!verifyUrl) return;
    verifyLoading = true;
    verifyError = null;
    verifyResult = null;
    try {
      verifyResult = await ob20VerifyUrl(verifyUrl);
    } catch (e) {
      verifyError = e instanceof Error ? e.message : String(e);
    } finally {
      verifyLoading = false;
    }
  }

  async function loadAssertionIntoVerify(assertionUrl: string) {
    sub = "verify";
    verifyUrl = assertionUrl;
    await doVerify();
  }

  let pngPreviewBlob = $state<Blob | null>(null);
  let pngPreviewUrl = $state<string | null>(null);

  $effect(() => {
    if (pngPreviewBlob) {
      const url = URL.createObjectURL(pngPreviewBlob);
      pngPreviewUrl = url;
      return () => URL.revokeObjectURL(url);
    } else {
      pngPreviewUrl = null;
    }
  });

  async function showBakedPng(assertionId: string) {
    const blob = await ob20FetchBakedPng(assertionId);
    pngPreviewBlob = blob;
  }

  function closePngPreview() {
    pngPreviewBlob = null;
  }

  async function doRevoke(assertionId: string, revoke: boolean) {
    revoking = true;
    revokeMessage = null;
    try {
      await ob20Revoke(assertionId, revoke, revoke ? "UI からの失効" : undefined);
      revokeMessage = revoke ? "失効しました" : "失効を解除しました";
      await refreshHistory();
    } catch (e) {
      revokeMessage = e instanceof Error ? e.message : String(e);
    } finally {
      revoking = false;
    }
  }

  function stepIcon(s: OB20VerifyStep): string {
    return s.valid ? "✓" : "×";
  }
  function stepClass(s: OB20VerifyStep): string {
    return s.valid ? "step ok" : "step ng";
  }

  const VALIDATOR_URL = "https://wisdomcerts-1edtech-validator-os4flvcq5q-an.a.run.app/upload?validatorId=OB30Inspector";
  let validatorTip = $state<string | null>(null);

  async function openInValidator(assertionUrl: string) {
    try {
      await navigator.clipboard.writeText(assertionUrl);
      validatorTip = `URL をコピー: ${assertionUrl}\n別タブで「Open Badges 2.0 Verifier」を選択 → URI 欄にペースト → Run`;
    } catch {
      validatorTip = `URL: ${assertionUrl}\n手動でコピーして validator の URI 欄に貼り付け`;
    }
    window.open(VALIDATOR_URL, "_blank", "noopener");
  }
</script>

<div class="panel">
  <div class="note">
    <strong>OB 2.0 (hosted)</strong> — URL で公開された assertion/badgeClass/profile を
    verifier が fetch して validation する方式。署名は使わず HTTPS TLS 信頼が前提。
    PNG baking (keyword <code>openbadges</code>) にも対応。
  </div>

  <nav class="sub-tabs">
    <button class:active={sub === "issue"} onclick={() => (sub = "issue")}>発行</button>
    <button class:active={sub === "verify"} onclick={() => (sub = "verify")}>検証</button>
  </nav>

  {#if sub === "issue"}
    <div class="card">
      <h3>Assertion 発行</h3>
      <label>
        受信者 email (SHA-256 + salt でハッシュ化して保存)
        <input bind:value={recipientEmail} placeholder="alice@example.com" />
      </label>
      <label>
        Badge 名
        <input bind:value={badgeName} />
      </label>
      <label>
        Badge 説明
        <textarea bind:value={badgeDescription} rows="2"></textarea>
      </label>
      <label>
        Criteria narrative
        <input bind:value={criteriaNarrative} />
      </label>
      <label>
        Issuer 名
        <input bind:value={issuerName} />
      </label>
      <label>
        Narrative (任意、受信者側ストーリー)
        <input bind:value={narrative} />
      </label>
      <label>
        Badge 画像 URL (任意、未指定なら default SVG)
        <input bind:value={imageUrl} placeholder="https://example.com/badge.png" />
      </label>
      <div class="actions">
        <button onclick={doIssue} disabled={issueLoading || !badgeName}>
          {issueLoading ? "発行中..." : "発行"}
        </button>
      </div>
      {#if issueError}<p class="error">error: {issueError}</p>{/if}

      {#if issued}
        <h4>発行結果</h4>
        <ul class="out">
          <li><strong>Assertion:</strong> <code>{issued.assertion.id}</code></li>
          <li><strong>BadgeClass:</strong> <code>{issued.badge.id}</code></li>
          <li><strong>Issuer Profile:</strong> <code>{issued.profile.id}</code></li>
          <li>
            <strong>Recipient:</strong> {issued.assertion.recipient.type} /
            hashed={String(issued.assertion.recipient.hashed)}
          </li>
        </ul>
        <div class="actions">
          <button onclick={() => loadAssertionIntoVerify(issued!.assertion.id)}>
            → この Assertion を検証
          </button>
          <button onclick={() => showBakedPng(issued!.assertion.id)}>
            PNG (baked)
          </button>
          <a href={issued.assertion.id} target="_blank" class="link-btn">
            hosted JSON を開く
          </a>
          <button class="ext" onclick={() => openInValidator(issued!.assertion.id)}>
            🌐 1EdTech 公式 validator で開く
          </button>
        </div>
        {#if validatorTip}
          <pre class="tip">{validatorTip}</pre>
        {/if}
        <details>
          <summary>Assertion JSON</summary>
          <pre>{JSON.stringify(issued.assertion, null, 2)}</pre>
        </details>
        <details>
          <summary>BadgeClass JSON</summary>
          <pre>{JSON.stringify(issued.badge, null, 2)}</pre>
        </details>
      {/if}
    </div>

    {#if history.length > 0}
      <div class="card">
        <h3>発行履歴</h3>
        <table>
          <thead>
            <tr>
              <th>発行時刻</th>
              <th>Badge 名</th>
              <th>受信者</th>
              <th>失効</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {#each history as rec}
              <tr class:revoked={rec.revoked}>
                <td>{rec.issuedOn.slice(0, 19)}</td>
                <td>{rec.badgeName}</td>
                <td class="truncate" title={rec.recipientIdentity}>
                  {rec.recipientIdentity.slice(0, 40)}
                </td>
                <td>{rec.revoked ? "✗ 失効" : "✓ 有効"}</td>
                <td class="row-actions">
                  <button class="small" onclick={() => loadAssertionIntoVerify(rec.assertionId)}>検証</button>
                  <button class="small ext" onclick={() => openInValidator(rec.assertionUrl)}>1EdTech</button>
                  <button class="small" onclick={() => showBakedPng(rec.assertionId)}>PNG</button>
                  {#if rec.revoked}
                    <button class="small warn" onclick={() => doRevoke(rec.assertionId, false)} disabled={revoking}>解除</button>
                  {:else}
                    <button class="small warn" onclick={() => doRevoke(rec.assertionId, true)} disabled={revoking}>失効</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if revokeMessage}<p class="hint">{revokeMessage}</p>{/if}
      </div>
    {/if}
  {:else}
    <div class="card">
      <h3>Assertion 検証</h3>
      <p class="hint">
        assertion URL を入力して「検証」。verifier は URL fetch →
        (OB v2 context / type / id / hosted_match / 失効 / badge fetch / profile fetch) を
        段階的に確認します。
      </p>
      <label>
        Assertion URL
        <input bind:value={verifyUrl} placeholder="http://127.0.0.1:3000/2.0/assertions/..." />
      </label>
      <div class="actions">
        <button onclick={doVerify} disabled={verifyLoading || !verifyUrl}>
          {verifyLoading ? "検証中..." : "検証"}
        </button>
      </div>
      {#if verifyError}<p class="error">error: {verifyError}</p>{/if}

      {#if verifyResult}
        <h4>検証結果</h4>
        {#if verifyResult.errors && verifyResult.errors.length > 0}
          <div class="fatal">
            <strong>warnings:</strong>
            <ul>
              {#each verifyResult.errors as e}
                <li>{e}</li>
              {/each}
            </ul>
          </div>
        {/if}
        <ul class="log">
          {#each verifyResult.steps as s}
            <li class={stepClass(s)}>
              <span class="icon">{stepIcon(s)}</span>
              <span>{s.label}</span>
              {#if s.message}<span class="detail">— {s.message}</span>{/if}
            </li>
          {/each}
        </ul>

        {#if verifyResult.badge}
          <details>
            <summary>BadgeClass (resolved)</summary>
            <pre>{JSON.stringify(verifyResult.badge, null, 2)}</pre>
          </details>
        {/if}
        {#if verifyResult.profile}
          <details>
            <summary>Issuer Profile (resolved)</summary>
            <pre>{JSON.stringify(verifyResult.profile, null, 2)}</pre>
          </details>
        {/if}
        <details>
          <summary>raw result</summary>
          <pre>{JSON.stringify(verifyResult, null, 2)}</pre>
        </details>
      {/if}
    </div>
  {/if}
</div>

{#if pngPreviewUrl}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={closePngPreview} onkeydown={(e) => e.key === "Escape" && closePngPreview()}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <img src={pngPreviewUrl} alt="Baked PNG" />
      <div class="modal-actions">
        <button onclick={closePngPreview}>閉じる</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .note {
    background: #f0f8ff;
    border: 1px solid #b0d0e8;
    padding: 0.6rem 0.85rem;
    border-radius: 6px;
    font-size: 0.85rem;
    color: #245;
  }
  .sub-tabs {
    display: flex;
    gap: 0.5rem;
  }
  .sub-tabs button {
    padding: 0.4rem 0.9rem;
    background: #eee;
    color: #333;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .sub-tabs button.active {
    background: #222;
    color: #fff;
    border-color: #222;
  }
  .card {
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  h3 {
    margin: 0;
    font-size: 1.05rem;
  }
  h4 {
    margin: 0.5rem 0 0.25rem;
    font-size: 0.95rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.85rem;
    color: #444;
  }
  input,
  textarea {
    padding: 0.4rem 0.6rem;
    font-size: 0.9rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: inherit;
  }
  textarea {
    font-family: ui-monospace, monospace;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.3rem;
  }
  button {
    padding: 0.4rem 0.9rem;
    background: #222;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  button:disabled {
    background: #aaa;
    cursor: not-allowed;
  }
  .link-btn {
    padding: 0.4rem 0.9rem;
    background: #056;
    color: #fff;
    border-radius: 4px;
    font-size: 0.9rem;
    text-decoration: none;
  }
  .out {
    list-style: none;
    padding: 0;
    margin: 0 0 0.5rem;
    font-size: 0.85rem;
  }
  .out li {
    margin-bottom: 0.2rem;
  }
  code {
    font-family: ui-monospace, monospace;
    background: #eee;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.8rem;
  }
  table {
    width: 100%;
    font-size: 0.85rem;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid #eee;
  }
  tr.revoked {
    background: #fff4ee;
  }
  .truncate {
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ui-monospace, monospace;
    font-size: 0.75rem;
  }
  .row-actions {
    display: flex;
    gap: 0.3rem;
  }
  .small {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }
  .small.warn {
    background: #a33;
  }
  button.ext {
    background: #056;
  }
  .tip {
    background: #fffaf0;
    border: 1px solid #f0c890;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.8rem;
    color: #533;
    white-space: pre-wrap;
    margin: 0.25rem 0 0;
  }
  .log {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .step {
    padding: 0.4rem 0.75rem;
    margin-bottom: 0.25rem;
    border-radius: 4px;
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
  .icon {
    width: 1.25rem;
    text-align: center;
    font-weight: bold;
  }
  .detail {
    color: #666;
    font-size: 0.85rem;
  }
  .fatal {
    background: #fff4e5;
    border: 1px solid #f0b080;
    padding: 0.6rem 0.85rem;
    border-radius: 4px;
    color: #852;
  }
  .error {
    color: #c00;
  }
  .hint {
    color: #666;
    font-size: 0.85rem;
  }
  pre {
    background: #f4f4f4;
    padding: 0.75rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.75rem;
    max-height: 300px;
  }
  details {
    margin-top: 0.25rem;
  }
  summary {
    cursor: pointer;
    color: #666;
    font-size: 0.85rem;
  }
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal {
    background: #fff;
    border-radius: 8px;
    padding: 1rem;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
  .modal img {
    max-width: 80vw;
    max-height: 70vh;
    object-fit: contain;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
