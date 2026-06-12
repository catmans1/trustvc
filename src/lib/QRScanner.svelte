<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import QrScanner from "qr-scanner";

  const dispatch = createEventDispatcher();

  let videoEl: HTMLVideoElement | null = null;
  let scanner: any = null;
  export let facingMode: "environment" | "user" = "environment";

  onMount(async () => {
    // configure worker path for Vite
    try {
      // @ts-ignore
      QrScanner.WORKER_PATH = new URL("qr-scanner/qr-scanner-worker.min.js", import.meta.url).toString();
    } catch (e) {
      // fallback: leave default
    }

    scanner = new QrScanner(
      videoEl!,
      (result: string) => {
        dispatch("scan", { data: result });
      },
      {
        returnDetailedScanResult: false,
        highlightScanRegion: true,
        preferredCamera: facingMode === "user" ? "user" : "environment",
      }
    );
    try {
      await scanner.start();
    } catch (err) {
      dispatch("error", { error: err });
    }
  });

  onDestroy(() => {
    if (scanner) {
      scanner.stop();
      scanner.destroy();
      scanner = null;
    }
  });

  export function stop() {
    if (scanner) scanner.stop();
  }

  export function start() {
    if (scanner) scanner.start();
  }
</script>

<div class="qr-scanner">
  <video bind:this={videoEl} muted playsinline style="width:100%;height:auto;border-radius:8px;background:#000"></video>
</div>

<style>
  .qr-scanner video {
    display: block;
  }
</style>
