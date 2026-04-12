const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const XENTARI_DIR = path.join(ROOT, 'xentari');
const TASK_DIR = path.join(XENTARI_DIR, 'tasks');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function pad(num) {
  return String(num).padStart(3, '0');
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function createTask(id, target, description, constraints = []) {
  return {
    id,
    target,
    description,
    constraints
  };
}

const projectDefinition = {
  project: 'todo-api',

  modules: [
    {
      name: 'user',
      fields: ['id', 'name', 'email']
    },
    {
      name: 'todo',
      fields: ['id', 'title', 'completed']
    }
  ]
};

function generateTasks() {
  ensureDir(TASK_DIR);
  const tasks = [];
  let stepCounter = 1;

  tasks.push(createTask(
    pad(stepCounter++),
    'src/index.js',
    'Initialize the express server entry point for the Todo API app. Set up basic routes and middleware.',
    [
      'Use express',
      'Listen on process.env.PORT or 3000',
      'Add a basic / health check route',
      'Use module.exports'
    ]
  ));

  tasks.push(createTask(
    pad(stepCounter++),
    'src/core/config/app.config.js',
    'Create the application configuration file mapping environments variables and default configs for Todo API.',
    [
      'Export an object with PORT and ENV keys',
      'Use process.env mapping'
    ]
  ));

  for (const mod of projectDefinition.modules) {
    tasks.push(createTask(
      pad(stepCounter++),
      `src/modules/${mod.name}/${mod.name}.model.js`,
      `Create the data model structure for ${mod.name}.`,
      [
        `Model must contain exactly these fields: ${mod.fields.join(', ')}`,
        'Export as a constant default object or mock schema definition'
      ]
    ));

    tasks.push(createTask(
      pad(stepCounter++),
      `src/modules/${mod.name}/${mod.name}.service.js`,
      `Create the service layer for ${mod.name} module containing business logic.`,
      [
        'Create basic CRUD methods (create, findAll, findOne, update, remove)',
        'Return mock data structures matching the model fields',
        'Use CommonJS module.exports'
      ]
    ));

    tasks.push(createTask(
      pad(stepCounter++),
      `src/modules/${mod.name}/${mod.name}.controller.js`,
      `Create the controller layer for ${mod.name} handling express HTTP requests.`,
      [
        `Import ${mod.name}.service.js`,
        'Create request parser and response mapping for CRUD operations',
        'Export standard Express request handler functions'
      ]
    ));

    tasks.push(createTask(
      pad(stepCounter++),
      `src/modules/${mod.name}/${mod.name}.routes.js`,
      `Create the Express router for ${mod.name} endpoints.`,
      [
        `Import express and ${mod.name}.controller.js`,
        `Define standard REST endpoints mapping to the controller functions`,
        'Export the router'
      ]
    ));
  }

  const plan = {
    project: projectDefinition.project,
    generatedAt: new Date().toISOString(),
    steps: tasks.map(t => t.id)
  };

  writeJSON(path.join(XENTARI_DIR, 'plan.json'), plan);

  for (const task of tasks) {
    writeJSON(path.join(TASK_DIR, `${task.id}.json`), task);
  }

  console.log(`✅ Deterministic Scaffold Generated:`);
  console.log(`   - Output Dir: ${XENTARI_DIR}`);
  console.log(`   - Total Steps: ${tasks.length}`);
  console.log(`\nTo execute this scaffolding, run:`);
  console.log(`zen run "scaffold project"`);
}

generateTasks();
