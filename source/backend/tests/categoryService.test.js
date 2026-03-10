const { listCategories, findCategoryById } = require('../services/categoryService');
const { GameRoundStore } = require('../services/gameService');
const { fetchRandomClip } = require('../services/clipService');

describe('categoryService', () => {
  test('listCategories returns an array of categories', () => {
    const categories = listCategories();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });

  test('findCategoryById returns the requested category', () => {
    const categories = listCategories();
    if (categories.length === 0) return;
    const id = categories[0].id;
    const category = findCategoryById(id);
    expect(category).toBeTruthy();
    expect(category?.id).toBe(id);
  });
});

describe('GameRoundStore metadata', () => {
  test('persists mode and category on create', () => {
    const store = new GameRoundStore();
    const { roundId } = store.create({ id: 'track-1' }, 'user-1', {
      mode: 'freeplay',
      categoryId: 'holiday',
    });

    const round = store.get(roundId);
    expect(round).toBeTruthy();
    expect(round.mode).toBe('freeplay');
    expect(round.categoryId).toBe('holiday');
  });
});

describe('clipService category filter', () => {
  test('returns clip matching requested category', async () => {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    try {
      const clip = await fetchRandomClip(baseUrl, { categoryId: 'holiday' });
      expect(clip).toBeTruthy();
      expect(clip.categoryId).toBe('holiday');
      expect(clip.categoryName).toBeTruthy();
    } catch (err) {
      if (/no clips available/i.test(err.message)) return;
      throw err;
    }
  });

  test('falls back to all when category not provided', async () => {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    try {
      const clip = await fetchRandomClip(baseUrl);
      expect(clip).toBeTruthy();
      expect(clip.categoryId).toBeTruthy();
    } catch (err) {
      if (/no clips available/i.test(err.message)) return;
      throw err;
    }
  });
});

