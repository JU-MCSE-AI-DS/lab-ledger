<script lang="ts">
  import { type HistoryEntry, formatStamp, describeEntry } from '../lib/history';
  let { entry }: { entry: HistoryEntry } = $props();
</script>

<p class="text-sm border-t border-hush-border pt-2 first:border-t-0 first:pt-0 [overflow-wrap:anywhere]" data-testid="history-line">
  <span class="muted mono text-xs">{formatStamp(entry.ts)}</span> <span class="muted">·</span> <span>{entry.by || 'unknown'}</span> <span class="muted">·</span> <span class="mono">{describeEntry(entry)}</span>
</p>
