<script lang="ts">
  import { onMount } from "svelte";
  import {
    listIssuedCredentials,
    ob20ListIssued,
    type CredentialRecord,
    type OB20IssuedRecord,
  } from "./api";
  import CredentialDetailView from "./CredentialDetailView.svelte";

  interface Props {
    publicBaseUrl: string;
  }

  let { publicBaseUrl }: Props = $props();

  interface UnifiedRow {
    version: "v3" | "v2";
    id: string;
    name: string;
    holder: string;
    issuedAt: string;
    revoked: boolean;
    v3Record?: CredentialRecord;
    v2Record?: OB20IssuedRecord;
  }

  let rows = $state<UnifiedRow[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let warnings = $state<string[]>([]);

  let selectedRow = $state<UnifiedRow | null>(null);

  onMount(async () => {
    try {
      const v3Warnings: string[] = [];
      const [v3, v2] = await Promise.all([
        listIssuedCredentials().catch((e) => {
          v3Warnings.push(`OB 3.0 一覧の取得に失敗: ${e instanceof Error ? e.message : String(e)}`);
          return [] as CredentialRecord[];
        }),
        ob20ListIssued().catch((e) => {
          v3Warnings.push(`OB 2.0 一覧の取得に失敗: ${e instanceof Error ? e.message : String(e)}`);
          return [] as OB20IssuedRecord[];
        }),
      ]);
      warnings = v3Warnings;

      const v3Rows: UnifiedRow[] = v3.map((r) => ({
        version: "v3" as const,
        id: r.id,
        name: r.achievementName,
        holder: r.subjectName,
        issuedAt: r.issuedAt,
        revoked: r.revoked,
        v3Record: r,
      }));

      const v2Rows: UnifiedRow[] = v2.map((r) => ({
        version: "v2" as const,
        id: r.assertionId,
        name: r.badgeName,
        holder: r.recipientIdentity,
        issuedAt: r.issuedOn,
        revoked: r.revoked,
        v2Record: r,
      }));

      rows = [...v3Rows, ...v2Rows].sort(
        (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
      );
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  });

  function selectRow(row: UnifiedRow) {
    selectedRow = row;
  }

  function backToList() {
    selectedRow = null;
  }
</script>

{#if selectedRow}
  <CredentialDetailView
    id={selectedRow.id}
    version={selectedRow.version}
    record={selectedRow.v3Record}
    ob2Record={selectedRow.v2Record}
    {publicBaseUrl}
    onBack={backToList}
  />
{:else}
  <div class="panel">
    <h2>発行済み証明書一覧</h2>

    {#each warnings as w}
      <p class="warn">{w}</p>
    {/each}

    {#if loading}
      <p class="muted">読み込み中...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if rows.length === 0}
      <p class="muted">発行済み証明書がありません。「発行」タブで作成してください。</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Ver</th>
            <th>Achievement / Badge</th>
            <th>Holder</th>
            <th>Issued</th>
            <th>Status</th>
            <th>VC</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr
              class:revoked={row.revoked}
              onclick={() => selectRow(row)}
              role="button"
              tabindex="0"
              onkeydown={(e) => { if (e.key === "Enter") selectRow(row); }}
            >
              <td><span class="ver" class:v3={row.version === "v3"} class:v2={row.version === "v2"}>{row.version === "v3" ? "3.0" : "2.0"}</span></td>
              <td class="name">{row.name}</td>
              <td class="holder">{row.holder}</td>
              <td class="date">{row.issuedAt.slice(0, 10)}</td>
              <td>{row.revoked ? "失効" : "有効"}</td>
              <td>
                {#if row.version === "v3"}
                  <a
                    href={`${publicBaseUrl}/credentials/${encodeURIComponent(row.id)}/vc`}
                    target="_blank"
                    rel="noopener"
                    class="vc-link"
                    onclick={(e) => e.stopPropagation()}
                  >JSON</a>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="count">{rows.length} 件</p>
    {/if}
  </div>
{/if}

<style>
  .panel { display: flex; flex-direction: column; gap: 0.75rem; }
  h2 { margin: 0 0 0.5rem; font-size: 1.15rem; }
  .muted { color: #666; font-size: 0.85rem; }
  .warn { color: #b45309; background: #fef3c7; padding: 0.4rem 0.75rem; border-radius: 4px; font-size: 0.85rem; margin: 0; }
  .error { color: #c00; }
  .count { color: #888; font-size: 0.8rem; margin: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th { text-align: left; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888; padding: 0.4rem 0.5rem; border-bottom: 2px solid #ddd; }
  td { padding: 0.5rem; border-bottom: 1px solid #eee; }
  tr { cursor: pointer; }
  tr:hover { background: #f0f4ff; }
  tr.revoked { background: #fef2f2; }
  tr.revoked:hover { background: #fee2e2; }
  .ver { font-size: 0.75rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 3px; }
  .ver.v3 { background: #e0e7ff; color: #3730a3; }
  .ver.v2 { background: #fef3c7; color: #92400e; }
  .name { font-weight: 500; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .holder { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #555; }
  .date { white-space: nowrap; color: #666; font-family: ui-monospace, monospace; font-size: 0.8rem; }
  .vc-link { color: #3730a3; font-size: 0.8rem; text-decoration: underline; text-underline-offset: 2px; }
  .vc-link:hover { color: #1e1b4b; }
  .muted { color: #999; font-size: 0.8rem; }
</style>
