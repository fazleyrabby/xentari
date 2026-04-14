const store = [];

module.exports = {
  create(data) {
    const item = { id: Date.now(), ...data };
    store.push(item);
    return item;
  },

  getAll() {
    return store;
  }
};
