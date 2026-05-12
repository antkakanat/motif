<script lang="ts">
  import { t } from '$lib/i18n';
  import { type CaptureType, type Capture } from '$lib/db';
  import { findDuplicateUrl } from '$lib/stores/captures';
  import { collections } from '$lib/stores/collections';
  import { isProUnlocked } from '$lib/pro';

  type Tab = CaptureType;

  export interface CaptureFormData {
    type: CaptureType;
    title: string;
    content: string;
    tags: string[];
    sourceUrl: string;
    collectionId: string | null;
  }

  export interface InitialData {
    type?: CaptureType;
    title?: string;
    content?: string;
    sourceUrl?: string;
    collectionId?: string | null;
  }

  let {
    open = $bindable(false),
    onSave,
    defaultTab = 'link' as Tab,
    initialData = null as InitialData | null
  }: {
    open: boolean;
    onSave: (data: CaptureFormData) => void;
    defaultTab?: Tab;
    initialData?: InitialData | null;
  } = $props();

  let unlocked = $derived(isProUnlocked());

  let activeTab = $state<Tab>('link');

  $effect(() => {
    if (open) {
      if (initialData) {
        activeTab = initialData.type || defaultTab;
        title = initialData.title || '';
        content = initialData.content || '';
        sourceUrl = initialData.sourceUrl || '';
        collectionId = initialData.collectionId || null;
      } else {
        activeTab = defaultTab;
      }
    }
  });
  let title = $state('');
  let content = $state('');
  let sourceUrl = $state('');
  let tagInput = $state('');
  let tags = $state<string[]>([]);
  let collectionId = $state<string | null>(null);
  let duplicateCapture = $state<Capture | undefined>(undefined);

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
  }

  function close() {
    open = false;
    reset();
  }

  function handleSave() {
    if (!content.trim() && activeTab !== 'note') return;

    // Title priority for link captures:
    // 1. User-entered title (always preserve if provided)
    // 2. OG title fetched from URL (Phase 2 — when proxy is built)
    // 3. URL itself as fallback (current Phase 1 behavior)
    onSave({
      type: activeTab,
      title: title.trim() || (activeTab === 'link' ? content.trim() : t('capture.noTitle')),
      content: content.trim(),
      tags: [...tags],
      sourceUrl: sourceUrl.trim(),
      collectionId
    });

    close();
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

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'link', label: t('capture.addLink'), icon: '🔗' },
    { key: 'quote', label: t('capture.addQuote'), icon: '❝' },
    { key: 'note', label: t('capture.addNote'), icon: '✎' },
    { key: 'image', label: t('capture.addImage'), icon: '◻' }
  ];

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
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdropClick} role="presentation">
    <div class="modal scale-in" role="dialog" aria-modal="true" aria-label={t('capture.addNew')}>
      <!-- Tab bar -->
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
            <span class="tab-icon">{tab.icon}</span>
            <span class="tab-label">{tab.label}</span>
          </button>
        {/each}
      </div>

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
          <input
            type="url"
            class="input"
            placeholder={t('capture.urlPlaceholder')}
            bind:value={content}
          />
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
              <button class="btn-text" onclick={() => content = ''}>Remove</button>
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

        <!-- Collection Selection (Pro Only) -->
        {#if unlocked && $collections.length > 0}
          <div class="form-group">
            <label class="form-label" for="collection-select">{t('collections.addToCollection')}</label>
            <select
              id="collection-select"
              class="form-select"
              bind:value={collectionId}
            >
              <option value={null}>{t('collections.none')}</option>
              {#each $collections as col}
                <option value={col.id}>{col.name}</option>
              {/each}
            </select>
          </div>
        {/if}

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
    font-size: 1rem;
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
</style>
