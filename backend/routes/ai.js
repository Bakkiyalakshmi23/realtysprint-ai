'use strict';

const express = require('express');
const router = express.Router();
const ai = require('../ai');

router.get('/status', (req, res) => {
  return res.json({ success: true, data: ai.getStatus() });
});

module.exports = router;
