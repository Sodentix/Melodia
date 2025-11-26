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

module.exports = {
  listCategories,
  findCategoryById,
};

