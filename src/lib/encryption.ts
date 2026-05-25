import { writable, get } from 'svelte/store';
import { db, type Capture } from './db';
import { settings, setDbEncrypted } from '$lib/stores/settings';
import { showToast } from '$lib/stores/toast';

// ── Session state ──
export const sessionKey = writable<CryptoKey | null>(null);
export const isLocked = writable<boolean>(false);

// ── DB Rewrite Progress ──
export const rewriteTotal = writable<number>(0);
export const rewriteDone = writable<number>(0);
export const isRewriting = writable<boolean>(false);

// ── Wordlist for BIP-39-style 12-word recovery phrase ──
const WORDLIST = [
  "about", "above", "action", "active", "actor", "admit", "adopt", "advice",
  "afraid", "after", "again", "against", "agree", "ahead", "alarm", "album",
  "alert", "alike", "alive", "allot", "allow", "almost", "alone", "along",
  "alpha", "alter", "always", "amber", "among", "anchor", "angry", "animal",
  "annual", "another", "answer", "antique", "anxious", "apart", "apple", "apron",
  "arctic", "arena", "argue", "arise", "armor", "army", "around", "arrow",
  "artist", "ascend", "asleep", "aspect", "assist", "assume", "athlete", "atlas",
  "attack", "attend", "attic", "audio", "audit", "autumn", "avenue", "average",
  "avoid", "awake", "award", "aware", "away", "awesome", "awful", "baby",
  "back", "bacon", "badge", "bagel", "baggy", "baker", "balance", "balcony",
  "ballot", "bamboo", "banana", "banner", "barley", "barrel", "barrier", "base",
  "basic", "basket", "battle", "beach", "beacon", "bean", "beauty", "before",
  "begin", "behave", "behind", "belief", "belong", "below", "bench", "benefit",
  "berry", "beyond", "bicycle", "binary", "bird", "birth", "biscuit", "bitter",
  "black", "blade", "blame", "blank", "blast", "blaze", "blend", "blind",
  "blink", "bliss", "block", "blonde", "blood", "bloom", "blossom", "blue",
  "board", "boat", "body", "boiler", "bold", "bolt", "bomb", "bond",
  "bone", "bonus", "book", "boost", "border", "boring", "borrow", "boss",
  "bottom", "bounce", "bound", "bounty", "bowl", "boxer", "brain", "brake",
  "branch", "brand", "brass", "brave", "bread", "break", "breath", "breeze",
  "brick", "bridge", "brief", "bright", "bring", "brisk", "broad", "broken",
  "bronze", "brook", "broom", "brown", "brush", "bubble", "bucket", "budget",
  "buffalo", "build", "bulb", "bullet", "bundle", "bunker", "burden", "burger",
  "burn", "burst", "bushel", "business", "busy", "butter", "buyer", "buzz",
  "cabin", "cable", "cactus", "cage", "cake", "call", "calm", "camera",
  "camp", "canal", "canary", "candle", "candy", "cannon", "canoe", "canvas",
  "canyon", "capable", "cape", "capital", "captain", "caravan", "carbon", "card",
  "career", "careful", "cargo", "carpet", "carrot", "carry", "cart", "carve",
  "case", "cash", "casino", "castle", "casual", "cat", "catch", "cater",
  "cattle", "cause", "cave", "caviar", "ceiling", "celery", "cellar", "cement",
  "census", "century", "cereal", "certain", "chain", "chair", "chalk", "champion",
  "chance", "change", "channel", "chaos", "chapter", "charge", "charity", "charm",
  "charter", "chase", "chat", "cheap", "cheat", "check", "cheek", "cheer",
  "cheese", "chef", "cherry", "chest", "chicken", "chief", "child", "chime",
  "chimney", "china", "chip", "choice", "choir", "choose", "chronic", "chubby",
  "chuck", "chuckle", "churn", "cider", "cigar", "cinema", "circle", "circus",
  "citizen", "city", "civil", "claim", "clam", "clan", "clarity", "clash",
  "clasp", "class", "classic", "clause", "clay", "clean", "clear", "clerk",
  "clever", "click", "client", "cliff", "climate", "climb", "clinic", "clip",
  "clock", "clog", "cloister", "close", "cloth", "cloud", "clover", "clown",
  "club", "clump", "cluster", "clutch", "coach", "coal", "coast", "cobalt",
  "cobra", "cocoa", "coconut", "code", "coffee", "coffin", "cohort", "coil",
  "coin", "cold", "collar", "collect", "college", "colloidal", "colony", "color",
  "column", "combat", "combine", "comedy", "comfort", "comic", "coming", "command",
  "commit", "common", "compact", "company", "compare", "compass", "compel", "compete",
  "complex", "comply", "compound", "comrade", "conceal", "concept", "concern", "concert",
  "concrete", "condor", "conduct", "cone", "confer", "confess", "confirm", "conflict",
  "confront", "confuse", "congest", "congress", "connect", "conquer", "conscious", "consent",
  "conserve", "consider", "consist", "console", "consonant", "constable", "constant", "consult",
  "consume", "contact", "contain", "content", "contest", "context", "continue", "contour",
  "contract", "contrary", "control", "convent", "converse", "convert", "convict", "convince",
  "cook", "cool", "coop", "cope", "copper", "coral", "cord", "core",
  "cork", "corn", "corner", "corona", "corporal", "correct", "corridor", "corrupt"
];

export function generateRecoveryPhrase(): string {
  const array = new Uint32Array(12);
  crypto.getRandomValues(array);
  const words = Array.from(array).map(val => WORDLIST[val % WORDLIST.length]);
  return words.join(' ');
}

// ── Web Crypto Helpers ──

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password.trim().toLowerCase());

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(plainText: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = encoder.encode(plainText);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const cipherHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${ivHex}:${cipherHex}`;
}

export async function decryptText(encryptedText: string, key: CryptoKey): Promise<string> {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) throw new Error('Invalid encrypted text format');

  const iv = new Uint8Array(parts[0].match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const ciphertext = new Uint8Array(parts[1].match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// ── Capture Record Encryption / Decryption ──

export async function encryptCapture(c: Capture, key: CryptoKey): Promise<Capture> {
  const encrypted = { ...c };

  if (c.title) {
    encrypted.title = 'enc:' + await encryptText(c.title, key);
  }
  if (c.content) {
    encrypted.content = 'enc:' + await encryptText(c.content, key);
  }
  if (c.ocrText) {
    encrypted.ocrText = 'enc:' + await encryptText(c.ocrText, key);
  }
  if (c.tags && c.tags.length > 0) {
    const serializedTags = JSON.stringify(c.tags);
    encrypted.tags = ['enc_json:' + await encryptText(serializedTags, key)];
  }

  // Encrypt offline reading cache fields
  if (c.readableHtml) {
    encrypted.readableHtml = 'enc:' + await encryptText(c.readableHtml, key);
  }
  if (c.readableText) {
    encrypted.readableText = 'enc:' + await encryptText(c.readableText, key);
  }
  if (c.readableTitle) {
    encrypted.readableTitle = 'enc:' + await encryptText(c.readableTitle, key);
  }
  if (c.readableByline) {
    encrypted.readableByline = 'enc:' + await encryptText(c.readableByline, key);
  }
  if (c.readableSiteName) {
    encrypted.readableSiteName = 'enc:' + await encryptText(c.readableSiteName, key);
  }
  if (c.archiveError) {
    encrypted.archiveError = 'enc:' + await encryptText(c.archiveError, key);
  }

  return encrypted;
}

export async function decryptCapture(c: Capture, key: CryptoKey): Promise<Capture> {
  const decrypted = { ...c };

  if (c.title && c.title.startsWith('enc:')) {
    decrypted.title = await decryptText(c.title.slice(4), key);
  }
  if (c.content && c.content.startsWith('enc:')) {
    decrypted.content = await decryptText(c.content.slice(4), key);
  }
  if (c.ocrText && c.ocrText.startsWith('enc:')) {
    decrypted.ocrText = await decryptText(c.ocrText.slice(4), key);
  }
  if (c.tags && c.tags.length === 1 && c.tags[0].startsWith('enc_json:')) {
    const jsonStr = await decryptText(c.tags[0].slice(9), key);
    decrypted.tags = JSON.parse(jsonStr);
  }

  // Decrypt offline reading cache fields
  if (c.readableHtml && c.readableHtml.startsWith('enc:')) {
    decrypted.readableHtml = await decryptText(c.readableHtml.slice(4), key);
  }
  if (c.readableText && c.readableText.startsWith('enc:')) {
    decrypted.readableText = await decryptText(c.readableText.slice(4), key);
  }
  if (c.readableTitle && c.readableTitle.startsWith('enc:')) {
    decrypted.readableTitle = await decryptText(c.readableTitle.slice(4), key);
  }
  if (c.readableByline && c.readableByline.startsWith('enc:')) {
    decrypted.readableByline = await decryptText(c.readableByline.slice(4), key);
  }
  if (c.readableSiteName && c.readableSiteName.startsWith('enc:')) {
    decrypted.readableSiteName = await decryptText(c.readableSiteName.slice(4), key);
  }
  if (c.archiveError && c.archiveError.startsWith('enc:')) {
    decrypted.archiveError = await decryptText(c.archiveError.slice(4), key);
  }

  return decrypted;
}

// Helper to encrypt a list
export async function encryptCapturesList(list: Capture[], key: CryptoKey): Promise<Capture[]> {
  const results: Capture[] = [];
  for (const c of list) {
    results.push(await encryptCapture(c, key));
  }
  return results;
}

// Helper to decrypt a list
export async function decryptCapturesList(list: Capture[], key: CryptoKey): Promise<Capture[]> {
  const results: Capture[] = [];
  for (const c of list) {
    try {
      results.push(await decryptCapture(c, key));
    } catch (err) {
      console.error(`Failed to decrypt capture ${c.id}:`, err);
      results.push(c); // fallback
    }
  }
  return results;
}

// ── Database Verification Block Helpers ──

export async function createVerification(key: CryptoKey): Promise<string> {
  return await encryptText('motif-encrypted-db', key);
}

export async function checkVerification(verification: string, key: CryptoKey): Promise<boolean> {
  try {
    const plain = await decryptText(verification, key);
    return plain === 'motif-encrypted-db';
  } catch {
    return false;
  }
}
