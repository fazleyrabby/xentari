module.exports = function createModel(data) {
  return {
    id: data.id,
    ...data
  };
};
