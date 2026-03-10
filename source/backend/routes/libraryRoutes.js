const express = require('express');
const auth = require('../middleware/auth');
const { listClips, searchClips } = require('../services/clipService');

const router = express.Router();

// List all available local clips (auth required)
router.get('/all', auth(true, true), (req, res) => {
  try {
    const base = `${req.protocol}://${req.get('host')}`;
    const items = listClips(base);
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list clips' });
  }
});

const MAX_SEARCH_QUERY_LENGTH = 200;

router.get('/search', auth(true, true), (req, res) => {
  try {
    const raw = (req.query.q || '').toString();
    const q = raw.length > MAX_SEARCH_QUERY_LENGTH ? raw.slice(0, MAX_SEARCH_QUERY_LENGTH) : raw;
    const base = `${req.protocol}://${req.get('host')}`;
    const items = q ? searchClips(q, base) : [];
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to search clips' });
  }
});

module.exports = router;


