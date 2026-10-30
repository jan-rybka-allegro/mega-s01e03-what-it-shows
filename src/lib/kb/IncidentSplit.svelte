<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import { groupByCause, uniqueById, type Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';

  let { ticket }: { ticket: number } = $props();

  const exported = reports as Report[];
  const unique = uniqueById(exported);
  const merged = $derived(unique.filter((r) => r.mergedInto === ticket));
  const groups = $derived(groupByCause(merged, tenantOf));
  const repeatedRows = exported.length - unique.length;
  const readAsOneDayMove = $derived(
    merged.filter((r) => notes.oneDayMove.includes(r.id)).length,
  );

  const tagSummary = (tags: Record<string, number>) =>
    Object.entries(tags)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => `${tag} ×${count}`)
      .join(' · ');
</script>

<p>
  <strong>{merged.length}</strong> unique reports merged into #{ticket}, across
  <strong>{groups.length}</strong> causes. The export has {exported.length} rows;
  {repeatedRows} repeat an ID and are counted once.
</p>

<table>
  <thead>
    <tr>
      <th>cause</th><th>reports</th><th>tenants</th><th>intake tags</th><th>first → last</th>
    </tr>
  </thead>
  <tbody>
    {#each groups as group (group.cause)}
      <tr>
        <td><code>{group.cause}</code></td>
        <td>{group.reports.length}</td>
        <td>{group.tenants}</td>
        <td>{tagSummary(group.taggedAs)}</td>
        <td>{group.firstSeen} → {group.lastSeen}</td>
      </tr>
    {/each}
  </tbody>
</table>

<p class="note">
  The desk described {readAsOneDayMove} reports as a one-day move. They stay in their
  tenant-derived cause group; that description alone does not establish another cause.
</p>

<style>
  .note { color: var(--muted); font-size: 0.9rem; }
</style>
