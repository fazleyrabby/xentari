const express = require('express');

module.exports = (controller) => {
  const router = express.Router();

  router.post('/', controller.create);
  router.get('/', controller.getAll);

  return router;
};
