<script lang="ts">
  import { onMount } from "svelte";
  import {
    fetchIssuedVC,
    verifyCredential,
    revokeCredential,
    fetchDistribution,
    fetchGoogleWalletUrl,
    fetchAppleWalletPkpass,
    ob20VerifyUrl,
    ob20FetchBakedPng,
    ob20Revoke,
    type Credential,
    type CredentialRecord,
    type VerificationResponse,
    type VerificationStep,
    type OB20IssuedRecord,
    type OB20Assertion,
  } from "./api";

  interface Props {
    id: string;
    version: "v3" | "v2";
    record?: CredentialRecord;
    ob2Record?: OB20IssuedRecord;
    publicBaseUrl: string;
    onBack: () => void;
  }

  let { id, version, record, ob2Record, publicBaseUrl, onBack }: Props = $props();

  let vc = $state<Credential | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let verifyLoading = $state(false);
  let verifyResult = $state<VerificationResponse | null>(null);
  let verifyError = $state<string | null>(null);

  let walletLoading = $state<string | null>(null);
  let walletError = $state<string | null>(null);

  let revokeLoading = $state(false);
  let revokeMsg = $state<string | null>(null);
  let isRevoked = $state(record?.revoked ?? ob2Record?.revoked ?? false);

  onMount(async () => {
    try {
      if (version === "v3") {
        vc = await fetchIssuedVC(id);
      } else if (ob2Record) {
        const res = await fetch(`/api/2.0/assertions/${encodeURIComponent(ob2Record.assertionId.split("/").pop()!)}`);
        if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
        vc = await res.json();
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  });

  function vcField(path: string): string {
    if (!vc) return "—";
    const parts = path.split(".");
    let cur: unknown = vc;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") return "—";
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : cur != null ? String(cur) : "—";
  }

  // v3 fields
  $effect(() => {
    if (vc && version === "v3") {
      isRevoked = record?.revoked ?? false;
    }
  });

  function getTitle(): string {
    if (version === "v3") return vcField("credentialSubject.achievement.name") || vcField("name");
    return ob2Record?.badgeName ?? "—";
  }
  function getHolder(): string {
    if (version === "v3") return vcField("credentialSubject.name");
    return ob2Record?.recipientIdentity ?? "—";
  }
  function getIssued(): string {
    if (version === "v3") return (vcField("validFrom") ?? "").slice(0, 10);
    return (ob2Record?.issuedOn ?? "").slice(0, 10);
  }
  function getIssuer(): string {
    if (version === "v3") return vcField("issuer.name");
    return "—";
  }
  function getDescription(): string {
    if (version === "v3") return vcField("credentialSubject.achievement.description");
    return "—";
  }

  async function doVerify() {
    verifyLoading = true;
    verifyResult = null;
    verifyError = null;
    try {
      if (version === "v3" && vc) {
        verifyResult = await verifyCredential(vc);
      } else if (version === "v2" && ob2Record) {
        const r = await ob20VerifyUrl(ob2Record.assertionUrl);
        verifyResult = {
          log: r.steps.map((s) => ({
            id: s.id,
            valid: s.valid,
            error: s.valid ? undefined : { message: s.message ?? "failed", name: s.id },
          })),
        };
      }
    } catch (e) {
      verifyError = e instanceof Error ? e.message : String(e);
    } finally {
      verifyLoading = false;
    }
  }

  let googleWalletSaveUrl = $state<string | null>(null);

  async function doGoogleWallet() {
    walletLoading = "google";
    walletError = null;
    googleWalletSaveUrl = null;
    try {
      const url = await fetchGoogleWalletUrl(id);
      googleWalletSaveUrl = url;
      window.open(url, "_blank");
    } catch (e) {
      walletError = e instanceof Error ? e.message : String(e);
    } finally {
      walletLoading = null;
    }
  }

  let appleWalletModal = $state<{ url: string; qr: string } | null>(null);

  async function doAppleWallet() {
    walletLoading = "apple";
    walletError = null;
    appleWalletModal = null;
    try {
      const result = await fetchAppleWalletPkpass(id);
      appleWalletModal = result;
    } catch (e) {
      walletError = e instanceof Error ? e.message : String(e);
    } finally {
      walletLoading = null;
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadFormat(format: "png" | "qr" | "pdf") {
    if (!vc) return;
    if (version === "v3") {
      const blob = await fetchDistribution(format, vc);
      const name = format === "pdf" ? "certificate.pdf" : format === "qr" ? "credential-qr.png" : "credential-baked.png";
      triggerDownload(blob, name);
    } else if (version === "v2" && ob2Record) {
      const blob = await ob20FetchBakedPng(ob2Record.assertionId);
      triggerDownload(blob, "ob20-baked.png");
    }
  }

  async function doRevoke(revoke: boolean) {
    revokeLoading = true;
    revokeMsg = null;
    try {
      if (version === "v3") {
        await revokeCredential(id, revoke);
      } else if (ob2Record) {
        await ob20Revoke(ob2Record.assertionId, revoke);
      }
      isRevoked = revoke;
      revokeMsg = revoke ? "失効しました" : "失効を解除しました";
    } catch (e) {
      revokeMsg = e instanceof Error ? e.message : String(e);
    } finally {
      revokeLoading = false;
    }
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
  function stepLabel(sid: string): string {
    const map: Record<string, string> = {
      valid_signature: "署名検証",
      proof_verification: "署名検証",
      expiration: "有効期限",
      revocation_status: "失効状態",
      revocation_check: "失効チェック",
      registered_issuer: "登録発行者",
    };
    return map[sid] ?? sid;
  }

  function getVcUrl(): string | null {
    if (version !== "v3" || !publicBaseUrl) return null;
    return `${publicBaseUrl}/credentials/${encodeURIComponent(id)}/vc`;
  }
</script>

<div class="detail">
  <button class="back" onclick={onBack}>← 一覧に戻る</button>

  {#if loading}
    <p class="muted">読み込み中...</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <div class="hero">
      <div class="hero-label">Achievement</div>
      <h1>{getTitle()}</h1>
      <div class="hero-grid">
        <div><div class="k">Holder</div><div class="v">{getHolder()}</div></div>
        <div><div class="k">Issued</div><div class="v">{getIssued()}</div></div>
      </div>
      <div class="badge-row">
        <span class="version-badge">{version === "v3" ? "OB 3.0" : "OB 2.0"}</span>
        {#if isRevoked}<span class="revoked-badge">REVOKED</span>{/if}
      </div>
      {#if getVcUrl()}
        <div class="vc-link-row">
          <a href={getVcUrl()} target="_blank" rel="noopener" class="vc-link">VC 公開 URL を開く ↗</a>
        </div>
      {/if}
    </div>

    <div class="card">
      <h2>Issuer</h2>
      <div class="kv">
        <span class="k">Name</span><span class="v">{getIssuer()}</span>
      </div>
      {#if version === "v3"}
        <div class="kv">
          <span class="k">DID</span><span class="v mono">{vcField("issuer.id")}</span>
        </div>
      {/if}
    </div>

    {#if getDescription() !== "—"}
      <div class="card">
        <h2>Description</h2>
        <p>{getDescription()}</p>
      </div>
    {/if}

    <div class="card">
      <h2>検証</h2>
      <div class="actions">
        <button onclick={doVerify} disabled={verifyLoading}>
          {verifyLoading ? "検証中..." : "検証を実行"}
        </button>
      </div>
      {#if verifyError}<p class="error">{verifyError}</p>{/if}
      {#if verifyResult?.log}
        <ul class="log">
          {#each verifyResult.log as step}
            <li class={stepClass(step)}>
              <span class="icon">{stepIcon(step)}</span>
              <span class="label">{stepLabel(step.id)}</span>
              {#if step.error}<span class="step-detail">— {step.error.message}</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if version === "v3"}
      <div class="card">
        <h2>Wallet に追加</h2>
        <div class="actions">
          <button class="wallet google" onclick={doGoogleWallet} disabled={walletLoading !== null}>
            {walletLoading === "google" ? "生成中..." : "Google Wallet に追加"}
          </button>
          <button class="wallet apple" onclick={doAppleWallet} disabled={walletLoading !== null}>
            {walletLoading === "apple" ? "生成中..." : "Apple Wallet に追加"}
          </button>
        </div>
        {#if walletError}
          <div class="wallet-error">
            <span class="wallet-error-icon">⚠</span>
            <span>{walletError}</span>
          </div>
        {/if}
        {#if googleWalletSaveUrl}
          <p class="hint">ポップアップがブロックされた場合: <a href={googleWalletSaveUrl} target="_blank" rel="noopener">こちらをクリック</a></p>
        {/if}
        <p class="hint">Google Wallet は Demo mode (Issuer アカウント本人のみ)。Apple Wallet は WalletWallet.dev 経由 (pkpass ダウンロード)。</p>
      </div>
    {/if}

    <div class="card">
      <h2>配布</h2>
      <div class="actions">
        {#if version === "v3"}
          <button onclick={() => downloadFormat("png")}>PNG (baked)</button>
          <button onclick={() => downloadFormat("pdf")}>PDF</button>
        {:else}
          <button onclick={() => downloadFormat("png")}>PNG (baked)</button>
        {/if}
      </div>
    </div>

    <div class="card">
      <h2>失効管理</h2>
      <div class="actions">
        <button class="revoke" onclick={() => doRevoke(true)} disabled={revokeLoading || isRevoked}>失効</button>
        <button onclick={() => doRevoke(false)} disabled={revokeLoading || !isRevoked}>失効解除</button>
        {#if revokeMsg}<span class="muted">{revokeMsg}</span>{/if}
      </div>
    </div>

    <details>
      <summary>Raw JSON</summary>
      <pre>{JSON.stringify(vc, null, 2)}</pre>
    </details>
  {/if}
</div>

{#if appleWalletModal}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={() => appleWalletModal = null} onkeydown={(e) => e.key === "Escape" && (appleWalletModal = null)}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <h2>Apple Wallet に追加</h2>
    <div class="modal-qr">
      <img src={appleWalletModal.qr} alt="QR Code" width="280" height="280" />
    </div>
    <p class="modal-hint">iPhone のカメラで QR コードをスキャンすると Wallet に追加できます</p>
    <div class="modal-actions">
      <a class="modal-btn" href={appleWalletModal.url} download>pkpass をダウンロード</a>
      <button class="modal-btn secondary" onclick={() => appleWalletModal = null}>閉じる</button>
    </div>
  </div>
</div>
{/if}

<style>
  .detail { display: flex; flex-direction: column; gap: 0.75rem; }
  .back { background: transparent; color: #555; border: 1px solid #ccc; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer; font-size: 0.9rem; align-self: flex-start; }
  .hero { background: linear-gradient(140deg, #283c8c, #4a6cf7); color: #fff; border-radius: 10px; padding: 1.5rem 1.25rem; }
  .hero-label { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.8; margin-bottom: 0.25rem; }
  .hero h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem; line-height: 1.3; }
  .hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .hero-grid .k { font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.75; }
  .hero-grid .v { font-size: 1rem; font-weight: 500; }
  .badge-row { display: flex; gap: 0.5rem; margin-top: 1rem; }
  .version-badge { font-size: 0.7rem; background: rgba(255,255,255,0.2); padding: 0.15rem 0.5rem; border-radius: 3px; }
  .revoked-badge { font-size: 0.7rem; background: #c00; padding: 0.15rem 0.5rem; border-radius: 3px; font-weight: 600; }
  .vc-link-row { margin-top: 0.75rem; }
  .vc-link { color: rgba(255,255,255,0.9); font-size: 0.8rem; text-decoration: underline; text-underline-offset: 2px; }
  .vc-link:hover { color: #fff; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem 1.25rem; }
  .card h2 { font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin: 0 0 0.5rem; font-weight: 600; }
  .card p { margin: 0; font-size: 0.9rem; color: #444; }
  .kv { display: flex; gap: 0.75rem; font-size: 0.9rem; margin-bottom: 0.35rem; }
  .kv .k { color: #888; min-width: 60px; }
  .kv .v { word-break: break-all; }
  .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  button { padding: 0.45rem 0.9rem; font-size: 0.9rem; background: #222; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
  button:disabled { background: #999; cursor: not-allowed; }
  .wallet.google { background: #1a73e8; }
  .wallet.apple { background: #333; }
  .revoke { background: #a33; }
  .error { color: #c00; font-size: 0.85rem; }
  .wallet-error { display: flex; align-items: center; gap: 0.5rem; background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; }
  .wallet-error-icon { font-size: 1.1rem; }
  .muted { color: #666; font-size: 0.85rem; align-self: center; }
  .hint { color: #888; font-size: 0.78rem; margin: 0; }
  .log { list-style: none; padding: 0; margin: 0.5rem 0 0; }
  .step { padding: 0.35rem 0.6rem; margin-bottom: 0.2rem; border-radius: 4px; background: #f4f4f4; display: flex; gap: 0.5rem; align-items: center; font-size: 0.9rem; }
  .step.ok { background: #e6f7ee; color: #056; }
  .step.ng { background: #fdecea; color: #a00; }
  .step.warn { background: #fff4e5; color: #a60; }
  .icon { width: 1.25rem; text-align: center; font-weight: bold; }
  .step-detail { color: #666; font-size: 0.8rem; }
  details { margin-top: 0.5rem; }
  summary { cursor: pointer; color: #666; font-size: 0.85rem; }
  pre { background: #f4f4f4; padding: 0.75rem; border-radius: 4px; overflow-x: auto; font-size: 0.75rem; max-height: 400px; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal { background: #fff; border-radius: 12px; padding: 1.5rem; max-width: 360px; width: 90%; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
  .modal h2 { font-size: 1.1rem; font-weight: 700; color: #222; margin: 0 0 1rem; text-transform: none; letter-spacing: normal; }
  .modal-qr { display: flex; justify-content: center; margin-bottom: 0.75rem; }
  .modal-qr img { border-radius: 8px; }
  .modal-hint { color: #666; font-size: 0.8rem; margin: 0 0 1rem; }
  .modal-actions { display: flex; flex-direction: column; gap: 0.5rem; }
  .modal-btn { display: block; padding: 0.6rem 1rem; border-radius: 6px; font-size: 0.9rem; font-weight: 600; text-align: center; text-decoration: none; cursor: pointer; background: #333; color: #fff; border: none; }
  .modal-btn.secondary { background: transparent; color: #666; border: 1px solid #ddd; }
</style>
