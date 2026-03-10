const fs = require('fs');
const path = require('path');

const categoriesPath = path.join(__dirname, '..', 'assets', 'categories', 'categories.json');

let cache = null;
let lastLoaded = 0;

function readCategoriesFile() {
  try {
    const stat = fs.statSync(categoriesPath);
    if (!cache || stat.mtimeMs !== lastLoaded) {
      const raw = fs.readFileSync(categoriesPath, 'utf8');
      const parsed = JSON.parse(raw);
      cache = Array.isArray(parsed) ? parsed : [];
      lastLoaded = stat.mtimeMs;
    }
  } catch (err) {
    cache = [];
  }
  return cache;
}

function listCategories() {
  return readCategoriesFile();
}

function findCategoryById(id) {
  if (!id) return null;
  const lower = id.toString().toLowerCase();
  return listCategories().find((cat) => String(cat.id).toLowerCase() === lower) || null;
}

// ---- Admin helpers for writing / creating categories ----

const SAFE_CATEGORY_ID = /^[a-zA-Z0-9_]+$/;
const MAX_ID_LENGTH = 80;

function parseIdList(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val.filter((n) => Number.isInteger(n) && n > 0);
  if (typeof val === 'string') {
    return val
      .split(/[\s,;]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
  }
  return [];
}

function validateCategoryEntry(entry, index) {
  if (!entry || typeof entry !== 'object') return `Entry at index ${index}: must be an object`;
  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (!id) return `Entry at index ${index}: id is required`;
  if (id.length > MAX_ID_LENGTH) return `Entry at index ${index}: id too long`;
  if (!SAFE_CATEGORY_ID.test(id)) return `Entry at index ${index}: id may only contain letters, numbers, underscores`;
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  if (!name) return `Entry at index ${index}: name is required`;
  return null;
}

function normalizeCategoryForWrite(entry) {
  const playlistIds = parseIdList(entry.playlistIds);
  const trackIds = parseIdList(entry.trackIds);
  return {
    id: String(entry.id).trim(),
    name: String(entry.name || '').trim(),
    description: typeof entry.description === 'string' ? entry.description.trim() : '',
    difficulty: typeof entry.difficulty === 'string' ? entry.difficulty.trim() : 'easy',
    accent: typeof entry.accent === 'string' ? entry.accent.trim() : '#05d9ff',
    playlistIds,
    trackIds,
  };
}

function writeCategories(categoriesArray) {
  if (!Array.isArray(categoriesArray)) {
    throw new Error('Categories must be an array');
  }
  const validated = [];
  for (let i = 0; i < categoriesArray.length; i++) {
    const err = validateCategoryEntry(categoriesArray[i], i);
    if (err) throw new Error(err);
    validated.push(normalizeCategoryForWrite(categoriesArray[i]));
  }
  fs.writeFileSync(categoriesPath, JSON.stringify(validated, null, 2), 'utf8');
  cache = null;
  lastLoaded = 0;
  return readCategoriesFile();
}

function slugifyId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^$/, 'uncategorized');
}

function createCategory(payload) {
  const playlistIds = parseIdList(payload.playlistIds);
  const trackIds = parseIdList(payload.trackIds);
  if (playlistIds.length === 0 && trackIds.length === 0) {
    throw new Error('At least one playlist ID or track ID is required');
  }
  const id = typeof payload.id === 'string' && payload.id.trim()
    ? payload.id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    : slugifyId(payload.name || '');
  if (!id) throw new Error('Name is required');
  const existing = findCategoryById(id);
  if (existing) throw new Error(`Category id "${id}" already exists`);
  const normalized = normalizeCategoryForWrite({
    id,
    name: payload.name || id,
    description: payload.description || '',
    difficulty: payload.difficulty || 'easy',
    accent: payload.accent || '#05d9ff',
    playlistIds,
    trackIds,
  });
  const all = readCategoriesFile();
  all.push(normalized);
  fs.writeFileSync(categoriesPath, JSON.stringify(all, null, 2), 'utf8');
  cache = null;
  lastLoaded = 0;
  return readCategoriesFile().find((c) => c.id === id);
}

module.exports = {
  listCategories,
  findCategoryById,
  writeCategories,
  validateCategoryEntry,
  createCategory,
  parseIdList,
};
