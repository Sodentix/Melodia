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

router.get('/search', auth(true, true), (req, res) => {
  try {
    const q = (req.query.q || '').toString();
    const base = `${req.protocol}://${req.get('host')}`;
    const items = q ? searchClips(q, base) : [];
    return res.json({ items });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to search clips' });
  }
});

module.exports = router;


