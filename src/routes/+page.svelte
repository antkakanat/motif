<script lang="ts">
  import { t } from '$lib/i18n';
  import { page } from '$app/stores';
  import { nonTrashedCaptures, isLoading } from '$lib/stores/captures';
  import LandingPage from '$lib/components/LandingPage.svelte';
  import CaptureBrowser from '$lib/components/CaptureBrowser.svelte';
  import { settings } from '$lib/stores/settings';
  import { completeOnboarding } from '$lib/onboarding';

  let bypassLanding = $state(false);

  const hasDeepLink = $derived.by(() => {
    const params = $page.url.searchParams;
    return params.has('new') ||
           params.has('focus') ||
           params.has('status') ||
           params.has('url') ||
           params.has('title') ||
           params.has('text') ||
           params.has('ext_type');
  });

  // Auto-complete onboarding if there are captures
  $effect(() => {
    if (!$isLoading) {
      if (!$settings.onboardingDone && $nonTrashedCaptures.length > 0) {
        void completeOnboarding();
      }
    }
  });
</script>

<svelte:head>
  <title>All Captures — Motif</title>
</svelte:head>

{#if $nonTrashedCaptures.length === 0 && !bypassLanding && !hasDeepLink}
  <LandingPage onEnterDashboard={() => bypassLanding = true} />
{:else}
  <CaptureBrowser
    captures={$nonTrashedCaptures}
    title={t('nav.allCaptures') || 'All Captures'}
    icon="all"
    emptyTitle={t('empty.allCaptures') || 'Your private library is empty'}
    emptyHint={t('empty.allCapturesHint') || 'Add links, quotes, notes, or images to get started.'}
    newBtnLabel={t('capture.addNew') || 'Add New'}
    newBtnTab="link"
    showTypeFilter={true}
    showStatusFilter={true}
  />
{/if}
