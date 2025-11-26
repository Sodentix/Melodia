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
    const category = findCategoryById('all');
    expect(category).toBeTruthy();
    expect(category?.id).toBe('all');
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
    const clip = await fetchRandomClip('http://localhost:3000', { categoryId: 'holiday' });
    expect(clip).toBeTruthy();
    expect(clip.categoryId).toBe('holiday');
    expect(clip.categoryName).toBeTruthy();
  });

  test('falls back to all when category not provided', async () => {
    const clip = await fetchRandomClip('http://localhost:3000');
    expect(clip).toBeTruthy();
    expect(clip.categoryId).toBeTruthy();
  });
});

