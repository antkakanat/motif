<script lang="ts">
  import { t } from '$lib/i18n';
  import { type CaptureType, type Capture } from '$lib/db';
  import { findDuplicateUrl, runOcrOnCapture } from '$lib/stores/captures';
  import { activeOcrRuns } from '$lib/ocr';
  import { db } from '$lib/db';
  import { collections } from '$lib/stores/collections';
  import { isProUnlocked, requestProFeature } from '$lib/pro';
  import NavIcon from '$lib/components/NavIcon.svelte';
  import { fetchLinkMetadata, type LinkMetadata } from '$lib/metadata';
  import { settings } from '$lib/stores/settings';
  import { scheduleReminder, cancelReminder, checkNotificationPermission, formatReminderDate } from '$lib/reminders';

  type Tab = CaptureType;

  export interface CaptureFormData {
    type: CaptureType;
    title: string;
    content: string;
    tags: string[];
    sourceUrl: string;
    collectionId: string | null;
    ocrText?: string | null;
    ocrStatus?: string;
  }

  export interface InitialData {
    id?: string;
    type?: CaptureType;
    title?: string;
    content?: string;
    sourceUrl?: string;
    collectionId?: string | null;
    tags?: string[];
    ocrText?: string | null;
    ocrStatus?: string;
  }

  let {
    open = $bindable(false),
    onSave,
    defaultTab = 'link' as Tab,
    initialData = null as InitialData | null,
    lockTab = false
  }: {
    open: boolean;
    onSave: (data: CaptureFormData) => void | Promise<void>;
    defaultTab?: Tab;
    initialData?: InitialData | null;
    lockTab?: boolean;
  } = $props();

  let unlocked = $derived(isProUnlocked());

  let activeTab = $state<Tab>('link');

  let title = $state('');
  let content = $state('');
  let sourceUrl = $state('');
  let tagInput = $state('');
  let tags = $state<string[]>([]);
  let collectionId = $state<string | null>(null);
  let duplicateCapture = $state<Capture | undefined>(undefined);
  
  let ocrText = $state<string | null>(null);
  let ocrStatus = $state<string | undefined>(undefined);
  let reminderAt = $state<string>('');
  let metadataLoading = $state(false);
  let metadataPreview = $state<LinkMetadata | null>(null);

  let isOcrRunning = $derived(initialData?.id ? $activeOcrRuns.has(initialData.id) : false);

  $effect(() => {
    if (open) {
      if (initialData) {
        activeTab = initialData.type || defaultTab;
        title = initialData.title || '';
        content = initialData.content || '';
        sourceUrl = initialData.sourceUrl || '';
        collectionId = initialData.collectionId || null;
        tags = initialData.tags ? [...initialData.tags] : [];
        ocrText = initialData.ocrText || null;
        ocrStatus = initialData.ocrStatus || undefined;
        tagInput = '';
      } else {
        activeTab = defaultTab;
        ocrText = null;
        ocrStatus = undefined;
        reminderAt = '';
        metadataPreview = null;
        reset();
      }
    }
  });

  let prevIsOcrRunning = false;
  $effect(() => {
    if (initialData?.id && !isOcrRunning && prevIsOcrRunning) {
      db.captures.get(initialData.id).then(cap => {
        if (cap) {
          ocrText = cap.ocrText || null;
          ocrStatus = cap.ocrStatus;
        }
      });
    }
    prevIsOcrRunning = isOcrRunning;
  });

  $effect(() => {
    if (activeTab === 'link' && content.trim()) {
      void checkForDuplicate();
    } else {
      duplicateCapture = undefined;
    }
  });

  async function checkForDuplicate() {
    duplicateCapture = await findDuplicateUrl(content.trim());
  }

  function reset() {
    title = '';
    content = '';
    sourceUrl = '';
    tagInput = '';
    tags = [];
    collectionId = null;
    duplicateCapture = undefined;
    reminderAt = '';
    metadataPreview = null;
  }

  function close() {
    open = false;
    reset();
  }

  async function handleSave() {
    if (!content.trim() && activeTab !== 'note') return;

    if (collectionId !== null) {
      const allowed = await requestProFeature('collections', 'Collections');
      if (!allowed) return;
    }

    // Title priority for link captures:
    // 1. User-entered title (always preserve if provided)
    // 2. OG title fetched from URL (Phase 2 — when proxy is built)
    // 3. URL itself as fallback (current Phase 1 behavior)
    await onSave({
      type: activeTab,
      title: title.trim() || (activeTab === 'link' ? content.trim() : t('capture.noTitle')),
      content: content.trim(),
      tags: [...tags],
      sourceUrl: sourceUrl.trim(),
      collectionId,
      ocrText,
      ocrStatus,
      ...(metadataPreview ? {
        favicon: metadataPreview.favicon,
        ogImage: metadataPreview.ogImage,
        description: metadataPreview.description
      } : {})
    });

    // Schedule reminder if set
    if (reminderAt && initialData?.id) {
      await scheduleReminder(initialData.id, new Date(reminderAt).toISOString());
    }

    // Haptic feedback on save
    (window as any).__motifVibrate?.(10);

    close();
  }

  async function triggerManualOcr() {
    const allowed = await requestProFeature('ocr', 'Local OCR');
    if (!allowed) return;

    if (!initialData?.id) {
      const { performOCR } = await import('$lib/ocr');
      ocrStatus = 'processing';
      try {
        const text = await performOCR(content);
        ocrText = text || null;
        ocrStatus = 'done';
      } catch (err: any) {
        console.error('Manual OCR failed:', err);
        ocrStatus = 'failed';
      }
      return;
    }

    await runOcrOnCapture(initialData.id, content, true);
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      tags = [...tags, tag];
    }
    tagInput = '';
  }

  function removeTag(tag: string) {
    tags = tags.filter((t) => t !== tag);
  }

  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      tags = tags.slice(0, -1);
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  async function handleCollectionGate(e: Event) {
    if (unlocked) return;
    e.preventDefault();
    e.stopPropagation();
    const allowed = await requestProFeature('collections', 'Collections');
    if (!allowed) return;
  }

  const tabs: { key: Tab; label: string; icon: 'link' | 'quote' | 'note' | 'image' }[] = [
    { key: 'link', label: t('capture.addLink'), icon: 'link' },
    { key: 'quote', label: t('capture.addQuote'), icon: 'quote' },
    { key: 'note', label: t('capture.addNote'), icon: 'note' },
    { key: 'image', label: t('capture.addImage'), icon: 'image' }
  ];

  async function handleUrlBlur() {
    const url = content.trim();
    if (activeTab !== 'link' || !url || !$settings.autoFetchMetadata) return;
    if (!url.startsWith('http')) return;
    metadataLoading = true;
    try {
      const meta = await fetchLinkMetadata(url);
      metadataPreview = meta;
      // Auto-fill title only if still empty
      if (!title.trim() && meta.title) {
        title = meta.title;
      }
    } catch {
      // silently ignore
    } finally {
      metadataLoading = false;
    }
  }

  function handleImageUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      content = reader.result as string;
      if (!title) title = file.name.replace(/\.[^.]+$/, '');
    };
    reader.readAsDataURL(file);
  }

  function setReminderPreset(offsetMs: number) {
    const dt = new Date(Date.now() + offsetMs);
    // Round to nearest 5 minutes
    dt.setMinutes(Math.ceil(dt.getMinutes() / 5) * 5, 0, 0);
    // Format as datetime-local value
    const pad = (n: number) => String(n).padStart(2, '0');
    reminderAt = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
    <div class="modal scale-in" role="dialog" aria-modal="true" aria-label={t('capture.addNew')}>
      <!-- Tab bar -->
      {#if !lockTab}
        <div class="modal-tabs">
          {#each tabs as tab}
            <button
              class="modal-tab"
              class:active={activeTab === tab.key}
              onclick={() => { 
                if (activeTab !== tab.key) {
                  activeTab = tab.key; 
                  reset(); 
                }
              }}
            >
              <span class="tab-icon"><NavIcon name={tab.icon} size={15} strokeWidth={2} /></span>
              <span class="tab-label">{tab.label}</span>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Form body -->
      <div class="modal-body">
        <!-- Title (all types) -->
        <input
          type="text"
          class="input"
          placeholder={t('capture.titlePlaceholder')}
          bind:value={title}
        />

        <!-- Type-specific content -->
        {#if activeTab === 'link'}
          <div class="url-input-wrapper">
            <input
              type="url"
              class="input"
              placeholder={t('capture.urlPlaceholder')}
              bind:value={content}
              onblur={handleUrlBlur}
            />
            {#if metadataLoading}
              <span class="url-fetching">🔍 Fetching preview...</span>
            {/if}
          </div>
          {#if metadataPreview && (metadataPreview.ogImage || metadataPreview.description)}
            <div class="og-preview fade-in">
              {#if metadataPreview.favicon}
                <img src={metadataPreview.favicon} alt="" class="og-favicon" width="16" height="16" />
              {/if}
              {#if metadataPreview.domain}
                <span class="og-domain">{metadataPreview.domain}</span>
              {/if}
              {#if metadataPreview.description}
                <p class="og-desc">{metadataPreview.description.slice(0, 120)}{metadataPreview.description.length > 120 ? '…' : ''}</p>
              {/if}
              {#if metadataPreview.ogImage}
                <img src={metadataPreview.ogImage} alt="Page preview" class="og-image" loading="lazy" />
              {/if}
              <button class="og-clear" onclick={() => metadataPreview = null} aria-label="Clear preview">×</button>
            </div>
          {/if}
          {#if duplicateCapture}
            <div class="duplicate-warning">
              <span class="warning-icon">⚠️</span>
              <span class="warning-text">{t('capture.duplicateWarning')}</span>
            </div>
          {/if}
        {:else if activeTab === 'quote'}
          <textarea
            class="input textarea"
            placeholder={t('capture.quotePlaceholder')}
            bind:value={content}
            rows="4"
          ></textarea>
          <input
            type="url"
            class="input"
            placeholder={t('capture.sourcePlaceholder')}
            bind:value={sourceUrl}
          />
        {:else if activeTab === 'note'}
          <textarea
            class="input textarea"
            placeholder={t('capture.notePlaceholder')}
            bind:value={content}
            rows="6"
          ></textarea>
        {:else if activeTab === 'image'}
          <div class="image-upload">
            {#if content}
              <img src={content} alt="Preview" class="image-preview" />
              <button class="btn-text" onclick={() => { content = ''; ocrText = null; ocrStatus = undefined; }}>Remove</button>

              <div class="ocr-modal-panel">
                <div class="ocr-modal-header">
                  <span class="ocr-modal-title">Extracted Text (OCR)</span>
                  {#if isOcrRunning || ocrStatus === 'processing'}
                    <span class="ocr-modal-status processing">Processing...</span>
                  {:else if ocrStatus === 'done'}
                    <span class="ocr-modal-status done">Completed</span>
                  {:else if ocrStatus === 'failed'}
                    <span class="ocr-modal-status failed">Failed</span>
                  {:else if ocrStatus === 'skipped'}
                    <span class="ocr-modal-status skipped">Skipped</span>
                  {/if}
                </div>

                {#if isOcrRunning || ocrStatus === 'processing'}
                  <div class="ocr-modal-loading">
                    <div class="spinner"></div>
                    <span>Extracting text from image locally...</span>
                  </div>
                {:else}
                  <textarea
                    class="input textarea ocr-textarea"
                    placeholder="No text extracted yet or extraction skipped. Click 'Extract Text' to run OCR."
                    bind:value={ocrText}
                    rows="4"
                  ></textarea>

                  <div class="ocr-actions-row">
                    {#if !ocrStatus || ocrStatus === 'skipped' || ocrStatus === 'failed'}
                      <button class="btn-small" type="button" onclick={triggerManualOcr}>
                        Extract Text
                      </button>
                    {:else if ocrStatus === 'done'}
                      <button class="btn-small" type="button" onclick={triggerManualOcr}>
                        Re-scan Image
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            {:else}
              <label class="upload-area">
                <input
                  type="file"
                  accept="image/*"
                  onchange={handleImageUpload}
                  hidden
                />
                <span class="upload-icon">📷</span>
                <span class="upload-text">Click to upload or paste an image</span>
              </label>
            {/if}
          </div>
        {/if}

        <!-- Collection Selection -->
        <div class="form-group" class:gated={!unlocked}>
          <div class="form-label-row">
            <label class="form-label" for="collection-select">{t('collections.addToCollection')}</label>
            {#if !unlocked}
              <button class="pro-chip" type="button" onclick={handleCollectionGate} aria-label="Collections is a Pro feature">
                <NavIcon name="lock" size={12} strokeWidth={2.2} />
                Pro feature
              </button>
            {/if}
          </div>
          <div class="select-lock-wrapper">
            <select
              id="collection-select"
              class="form-select"
              bind:value={collectionId}
              aria-disabled={!unlocked}
              onpointerdown={handleCollectionGate}
              onfocus={handleCollectionGate}
            >
              <option value={null}>{t('collections.none')}</option>
              {#each $collections as col}
                <option value={col.id}>{col.name}</option>
              {/each}
              {#if $collections.length === 0}
                <option value={null} disabled>{t('collections.empty')}</option>
              {/if}
            </select>
            {#if !unlocked}
              <button class="select-gate" type="button" onclick={handleCollectionGate} aria-label="Unlock Collections">
                <NavIcon name="lock" size={12} strokeWidth={2.2} />
              </button>
            {/if}
          </div>
        </div>

        <!-- Tags -->
        <div class="tags-section">
          <div class="tags-input-row">
            {#each tags as tag}
              <span class="tag-chip">
                {tag}
                <button class="tag-remove" onclick={() => removeTag(tag)}>×</button>
              </span>
            {/each}
            <input
              type="text"
              class="tag-input"
              placeholder={tags.length === 0 ? t('tags.addTag') : ''}
              bind:value={tagInput}
              onkeydown={handleTagKeydown}
              onblur={addTag}
            />
          </div>
        </div>

        <!-- Reminder -->
        <div class="reminder-section">
          <p class="reminder-label">🔔 Remind me</p>
          <div class="reminder-presets">
            <button class="preset-btn" class:active={false} onclick={() => setReminderPreset(60 * 60 * 1000)}>1h</button>
            <button class="preset-btn" class:active={false} onclick={() => setReminderPreset(24 * 60 * 60 * 1000)}>Tomorrow</button>
            <button class="preset-btn" class:active={false} onclick={() => setReminderPreset(7 * 24 * 60 * 60 * 1000)}>Next week</button>
            {#if reminderAt}
              <button class="preset-btn active clear-preset" onclick={() => reminderAt = ''}>Clear ×</button>
            {/if}
          </div>
          <input
            type="datetime-local"
            class="input reminder-input"
            bind:value={reminderAt}
          />
          {#if reminderAt}
            <p class="reminder-preview">⏰ {formatReminderDate(new Date(reminderAt).toISOString())}</p>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick={close}>{t('capture.cancel')}</button>
        <button class="btn btn-primary" onclick={handleSave}>{t('capture.save')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 14, 26, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }

  .modal {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 540px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: var(--shadow-xl);
  }

  .modal-tabs {
    display: flex;
    border-bottom: 1px solid var(--color-border);
    padding: 4px 4px 0;
  }

  .modal-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .modal-tab:hover {
    color: var(--color-text);
  }

  .modal-tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  .tab-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }

  .tab-label {
    display: none;
  }

  @media (min-width: 480px) {
    .tab-label {
      display: inline;
    }
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    font-family: var(--font-sans);
    transition: border-color var(--duration-fast) var(--ease-out);
    outline: none;
  }

  .input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(91, 78, 214, 0.1);
  }

  .duplicate-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: var(--radius-md);
    margin-top: -4px;
  }

  .warning-icon {
    font-size: 0.875rem;
  }

  .warning-text {
    font-size: 0.75rem;
    color: #92400e;
    font-weight: 500;
  }

  .textarea {
    resize: vertical;
    min-height: 80px;
  }

  /* Image upload */
  .image-upload {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .upload-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .upload-area:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
  }

  .upload-icon {
    font-size: 2rem;
    margin-bottom: 8px;
  }

  .upload-text {
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
  }

  .image-preview {
    max-width: 100%;
    max-height: 200px;
    object-fit: contain;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--color-danger);
    cursor: pointer;
    font-size: 0.8125rem;
    align-self: flex-start;
    padding: 4px 0;
  }

  /* Tags */
  .tags-section {
    margin-top: 4px;
  }

  .tags-input-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    min-height: 40px;
    align-items: center;
    cursor: text;
  }

  .tags-input-row:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(91, 78, 214, 0.1);
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .tag-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-primary);
    font-size: 0.875rem;
    padding: 0;
    line-height: 1;
    opacity: 0.6;
  }

  .tag-remove:hover {
    opacity: 1;
  }

  .tag-input {
    flex: 1;
    min-width: 100px;
    border: none;
    background: none;
    outline: none;
    font-size: 0.8125rem;
    color: var(--color-text);
    font-family: var(--font-sans);
  }

  .tag-input::placeholder {
    color: var(--color-text-secondary);
  }

  .form-select {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    font-family: var(--font-sans);
    outline: none;
    cursor: pointer;
  }

  .form-select:focus {
    border-color: var(--color-primary);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .pro-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    padding: 2px 8px;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;
    font-family: var(--font-sans);
  }

  .select-lock-wrapper {
    position: relative;
  }

  .form-group.gated .form-select {
    padding-right: 44px;
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-surface) 90%, var(--color-primary) 10%);
    cursor: pointer;
  }

  .select-gate {
    position: absolute;
    top: 50%;
    right: 8px;
    transform: translateY(-50%);
    border: none;
    border-radius: var(--radius-sm);
    background: var(--color-primary-subtle);
    color: var(--color-primary);
    padding: 4px 6px;
    font-size: 0.68rem;
    font-weight: 700;
    cursor: pointer;
    font-family: var(--font-sans);
  }

  /* Footer */
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
  }

  .btn {
    padding: 8px 20px;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
    border: none;
    font-family: var(--font-sans);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
    box-shadow: var(--shadow-sm);
  }

  .btn-ghost {
    background: none;
    color: var(--color-text-secondary);
  }

  .btn-ghost:hover {
    background: var(--color-surface);
    color: var(--color-text);
  }

  /* OCR Modal Panel Styles */
  .ocr-modal-panel {
    margin-top: 12px;
    background: color-mix(in srgb, var(--color-border) 20%, transparent);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
  }

  .ocr-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .ocr-modal-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .ocr-modal-status {
    font-size: 0.7rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
  }

  .ocr-modal-status.processing {
    color: var(--color-primary);
    background: var(--color-primary-subtle);
  }

  .ocr-modal-status.done {
    color: var(--color-accent);
    background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  }

  .ocr-modal-status.failed {
    color: var(--color-danger);
    background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  }

  .ocr-modal-status.skipped {
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-text-secondary) 15%, transparent);
  }

  .ocr-modal-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--color-border);
    border-radius: 50%;
    border-top-color: var(--color-primary);
    animation: ocr-spin 0.8s linear infinite;
  }

  @keyframes ocr-spin {
    to { transform: rotate(360deg); }
  }

  .ocr-textarea {
    font-size: 0.8125rem;
    line-height: 1.5;
    background: var(--color-surface);
  }

  .ocr-actions-row {
    display: flex;
    justify-content: flex-end;
  }

  .btn-small {
    padding: 6px 12px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-family: var(--font-sans);
    transition: all var(--duration-fast) var(--ease-out);
  }

  .btn-small:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }

  /* Phase F — URL metadata preview */
  .url-input-wrapper { position: relative; }

  .url-fetching {
    display: block;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
    padding: 4px 2px;
    animation: pulse-text 1.2s ease-in-out infinite;
  }

  @keyframes pulse-text {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }

  .og-preview {
    position: relative;
    margin-top: 6px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .og-favicon {
    display: inline-block;
    border-radius: 3px;
    object-fit: contain;
    vertical-align: middle;
  }

  .og-domain {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-secondary);
    letter-spacing: 0.02em;
    vertical-align: middle;
    margin-left: 4px;
  }

  .og-desc {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    line-height: 1.45;
  }

  .og-image {
    width: 100%;
    max-height: 140px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }

  .og-clear {
    position: absolute;
    top: 6px;
    right: 8px;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 1rem;
    cursor: pointer;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 4px;
  }

  .og-clear:hover { background: var(--color-border); color: var(--color-text); }

  /* Phase G — Reminder section */
  .reminder-section {
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
  }

  .reminder-label {
    margin: 0 0 8px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .reminder-presets {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .preset-btn {
    padding: 5px 12px;
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .preset-btn:hover, .preset-btn.active {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
  }

  .clear-preset {
    border-color: #ef4444;
    color: #ef4444;
    background: color-mix(in srgb, #ef4444 8%, transparent);
  }

  .clear-preset:hover {
    border-color: #ef4444;
    background: color-mix(in srgb, #ef4444 14%, transparent);
    color: #ef4444;
  }

  .reminder-input {
    font-size: 0.85rem;
    color-scheme: dark;
  }

  .reminder-preview {
    margin: 6px 0 0;
    font-size: 0.8rem;
    color: var(--color-primary);
    font-weight: 600;
  }
</style>
