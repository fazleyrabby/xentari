module.exports = (service) => ({
  create: async (req, res) => {
    try {
      const result = await service.create(req.body);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const result = await service.getAll();
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
});
