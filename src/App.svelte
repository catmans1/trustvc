<script lang="ts">
  import { onMount } from "svelte";
  import IssueView from "./lib/IssueView.svelte";
  import VerifyView from "./lib/VerifyView.svelte";
  import AttackView from "./lib/AttackView.svelte";
  import OB20View from "./lib/OB20View.svelte";
  import CredentialListView from "./lib/CredentialListView.svelte";
  import DemoIssueView from "./lib/DemoIssueView.svelte";
  import DemoVerifyView from "./lib/DemoVerifyView.svelte";
  import {
    fetchHealth,
    fetchIssuerInfo,
    type Credential,
    type HealthResponse,
    type IssuerInfo,
  } from "./lib/api";

  type Spec = "v3" | "v2";
  type Tab = "issue" | "verify" | "attack" | "list";

  let spec = $state<Spec>("v3");
  let tab = $state<Tab>("issue");
  let health = $state<HealthResponse | null>(null);
  let issuer = $state<IssuerInfo | null>(null);
  let bootError = $state<string | null>(null);
  let demoMode = $state(false);
  let pendingCredential = $state<Credential | null>(null);

  onMount(async () => {
    try {
      [health, issuer] = await Promise.all([fetchHealth(), fetchIssuerInfo()]);
    } catch (e) {
      bootError = e instanceof Error ? e.message : String(e);
      demoMode = true;
    }
  });

  function sendToVerify(credential: Credential) {
    pendingCredential = credential;
    tab = "verify";
  }
</script>

<main>
  <header>
    {#if health && issuer}
      <div class="meta">
        <span class="ok">backend: {health.status}</span>
        <span class="issuer" title={issuer.keyId}>v3 issuer: {issuer.did}</span>
      </div>
    {/if}
  </header>

  <!-- spec switch hidden per user request -->

  {#if spec === "v3"}
    <nav class="tabs">
      {#if demoMode}
        <button class:active={tab === "issue"} onclick={() => (tab = "issue")}>発行</button>
        <button class:active={tab === "verify"} onclick={() => (tab = "verify")}>検証</button>
      {:else}
        <button class:active={tab === "list"} onclick={() => (tab = "list")}>一覧</button>
        <button class:active={tab === "issue"} onclick={() => (tab = "issue")}>発行</button>
        <button class:active={tab === "verify"} onclick={() => (tab = "verify")}>検証</button>
        <button class:active={tab === "attack"} onclick={() => (tab = "attack")}>🎯 攻撃</button>
      {/if}
    </nav>
    <section>
      {#if tab === "list" && !demoMode}
        <CredentialListView publicBaseUrl={issuer?.publicBaseUrl ?? ""} />
      {:else if tab === "issue"}
        {#if demoMode}
          <DemoIssueView onVerify={sendToVerify} />
        {:else}
          <IssueView onVerify={sendToVerify} publicBaseUrl={issuer?.publicBaseUrl ?? ""} />
        {/if}
      {:else if tab === "verify"}
        {#if demoMode}
          <DemoVerifyView initialCredential={pendingCredential} />
        {:else}
          <VerifyView initialCredential={pendingCredential} />
        {/if}
      {:else if tab === "attack"}
        <AttackView />
      {/if}
    </section>
  {:else}
    <section>
      <OB20View />
    </section>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    background: #fafafa;
  }
  main {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 860px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
    color: #222;
  }
  header h1 {
    font-size: 1.6rem;
    margin: 0 0 0.25rem;
  }
  header .sub {
    color: #666;
    margin: 0 0 0.75rem;
  }
  .meta {
    display: flex;
    gap: 1rem;
    font-size: 0.85rem;
    color: #555;
    flex-wrap: wrap;
  }
  .ok {
    color: #0a7;
  }
  .issuer {
    font-family: ui-monospace, monospace;
    background: #eef;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    white-space: nowrap;
  }
  .error {
    color: #c00;
  }
  .muted {
    color: #999;
  }
  .spec-switch {
    display: flex;
    gap: 0.5rem;
    margin: 1rem 0 0.75rem;
    padding: 0.25rem;
    background: #eceff1;
    border-radius: 8px;
  }
  .spec-switch button {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    color: #555;
    font-size: 0.9rem;
    border-radius: 6px;
    cursor: pointer;
  }
  .spec-switch button.active {
    background: #fff;
    color: #222;
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  .tabs {
    display: flex;
    gap: 0.25rem;
    margin: 0.5rem 0 1rem;
    border-bottom: 1px solid #ddd;
  }
  .tabs button {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    font-size: 1rem;
    cursor: pointer;
    color: #666;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .tabs button.active {
    color: #222;
    border-bottom-color: #333;
    font-weight: 600;
  }
</style>
