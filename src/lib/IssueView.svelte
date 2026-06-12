<script lang="ts">
  import {
    fetchDistribution,
    issueCredential,
    revokeCredential,
    type Credential,
  } from "./api";

  interface Props {
    onVerify: (credential: Credential) => void;
    publicBaseUrl: string;
  }

  let { onVerify, publicBaseUrl }: Props = $props();

  const VALIDATOR_URL = "https://wisdomcerts-1edtech-validator-os4flvcq5q-an.a.run.app/upload?validatorId=OB30Inspector";
  let validatorTip = $state<string | null>(null);

  let recipientName = $state("タカ");
  let recipientId = $state("");
  let achievementName = $state("OB 3.0 PoC Complete");
  let achievementDescription = $state("Node/TS スタックで OB 3.0 発行→検証の round trip に成功");
  let issuerName = $state("WisdomCerts PoC");

  let loading = $state(false);
  let error = $state<string | null>(null);
  let credential = $state<Credential | null>(null);

  async function issue() {
    loading = true;
    error = null;
    credential = null;
    try {
      credential = await issueCredential({
        recipientName,
        recipientId: recipientId || undefined,
        achievementName,
        achievementDescription: achievementDescription || undefined,
        issuerName: issuerName || undefined,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function copyToClipboard() {
    if (!credential) return;
    await navigator.clipboard.writeText(JSON.stringify(credential, null, 2));
  }

  function vcPublicUrl(): string | null {
    if (!credential || !publicBaseUrl) return null;
    const id = credential.id;
    if (typeof id !== "string") return null;
    return `${publicBaseUrl}/credentials/${encodeURIComponent(id)}/vc`;
  }

  async function openInValidator() {
    const url = vcPublicUrl();
    if (!url) {
      validatorTip = "公開 URL が解決できません (publicBaseUrl 未取得)";
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      validatorTip = `URL をコピー: ${url}\n別タブで「Open Badges 3.0 Verifier」を選択 → URI 欄にペースト → Run`;
    } catch {
      validatorTip = `URL: ${url}\n手動でコピーして validator の URI 欄に貼り付け`;
    }
    window.open(VALIDATOR_URL, "_blank", "noopener");
  }

  function download() {
    if (!credential) return;
    const blob = new Blob([JSON.stringify(credential, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "credential.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  let previewBlob = $state<Blob | null>(null);
  let previewType = $state<"image" | "pdf" | null>(null);
  let previewUrl = $state<string | null>(null);
  let previewError = $state<string | null>(null);

  $effect(() => {
    if (previewBlob) {
      const url = URL.createObjectURL(previewBlob);
      previewUrl = url;
      return () => URL.revokeObjectURL(url);
    } else {
      previewUrl = null;
    }
  });

  async function showPreview(format: "png" | "qr" | "pdf") {
    if (!credential) return;
    previewError = null;
    try {
      const blob = await fetchDistribution(format, credential);
      previewBlob = blob;
      previewType = format === "pdf" ? "pdf" : "image";
    } catch (e) {
      previewError = e instanceof Error ? e.message : String(e);
    }
  }

  function closePreview() {
    previewBlob = null;
    previewType = null;
    previewError = null;
  }

  let revoking = $state(false);
  let revokeMessage = $state<string | null>(null);

  async function doRevoke(revoke: boolean) {
    if (!credential) return;
    const id = credential.id as string;
    if (!id) return;
    revoking = true;
    revokeMessage = null;
    try {
      await revokeCredential(id, revoke);
      revokeMessage = revoke ? "失効しました" : "失効を解除しました";
    } catch (e) {
      revokeMessage = e instanceof Error ? e.message : String(e);
    } finally {
      revoking = false;
    }
  }
</script>

<div class="panel">
  <h2>Credential 発行</h2>

  <label>
    受信者名
    <input bind:value={recipientName} placeholder="山田太郎" />
  </label>

  <label>
    受信者 ID (任意、URL/DID/urn。空なら urn:uuid 自動生成)
    <input bind:value={recipientId} placeholder="did:example:alice もしくは空欄" />
  </label>

  <label>
    Achievement 名
    <input bind:value={achievementName} placeholder="修了証書の名前" />
  </label>

  <label>
    Achievement 説明
    <textarea bind:value={achievementDescription} rows="2"></textarea>
  </label>

  <label>
    発行者名 (任意)
    <input bind:value={issuerName} placeholder="組織名など" />
  </label>

  <div class="actions">
    <button onclick={issue} disabled={loading || !recipientName || !achievementName}>
      {loading ? "発行中..." : "発行"}
    </button>
  </div>

  {#if error}
    <p class="error">error: {error}</p>
  {/if}

  {#if credential}
    <div class="result">
      <h3>発行結果 (署名済み VC)</h3>
      <div class="actions">
        <button onclick={() => onVerify(credential!)}>→ この VC を検証</button>
        <button onclick={copyToClipboard}>JSON コピー</button>
        <button onclick={download}>JSON</button>
        <button onclick={() => showPreview("png")}>PNG (baked)</button>
        <button onclick={() => showPreview("pdf")}>PDF</button>
      </div>
      <div class="actions">
        <button onclick={() => doRevoke(true)} disabled={revoking}>失効</button>
        <button onclick={() => doRevoke(false)} disabled={revoking}>失効解除</button>
        {#if revokeMessage}<span class="muted">{revokeMessage}</span>{/if}
      </div>
      <div class="actions external">
        <button onclick={async () => { const u = vcPublicUrl(); if (u) { try { await navigator.clipboard.writeText(u + '?format=json'); validatorTip = `コピー済み: ${u}?format=json`; } catch { validatorTip = `URL: ${u}?format=json`; } } }} disabled={!vcPublicUrl()}>
          📋 URL をコピー
        </button>
        <button class="ext" onclick={openInValidator} disabled={!vcPublicUrl()}>
          🌐 1EdTech validator で開く
        </button>
        <span class="muted">URL をコピー → validator の URI 欄にペースト → Run</span>
      </div>
      {#if validatorTip}
        <pre class="tip">{validatorTip}</pre>
      {/if}
      <p class="hint" style="margin-top:0.5rem;">
        改竄テストは上部「🎯 攻撃」タブから (発行履歴を選んで改竄パターンを適用)
      </p>
      {#if previewError}
        <p class="error">preview: {previewError}</p>
      {/if}
      <pre>{JSON.stringify(credential, null, 2)}</pre>
    </div>
  {/if}
</div>

{#if previewUrl && previewType}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="overlay" onclick={closePreview} onkeydown={(e) => e.key === "Escape" && closePreview()}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      {#if previewType === "image"}
        <img src={previewUrl} alt="Preview" />
      {:else}
        <embed src={previewUrl} type="application/pdf" width="100%" height="600" />
      {/if}
      <div class="modal-actions">
        <button onclick={closePreview}>閉じる</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.15rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
    color: #444;
  }
  input,
  textarea {
    padding: 0.45rem 0.6rem;
    font-size: 0.95rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: inherit;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
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
  .result {
    margin-top: 1rem;
  }
  h3 {
    font-size: 1rem;
    margin: 0 0 0.5rem;
  }
  pre {
    background: #f4f4f4;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.8rem;
    max-height: 480px;
  }
  .error {
    color: #c00;
  }
  .muted {
    color: #666;
    font-size: 0.85rem;
    align-self: center;
  }
  .hint {
    color: #666;
    font-size: 0.85rem;
  }
  .actions.external {
    align-items: center;
  }
  button.ext {
    background: #056;
  }
  button.ext:disabled {
    background: #aaa;
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
  .modal embed {
    min-width: 600px;
    min-height: 500px;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
