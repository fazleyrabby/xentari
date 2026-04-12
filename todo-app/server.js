const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

const todos = [];

app.get('/todos', (req, res) => {
  res.json(todos);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
