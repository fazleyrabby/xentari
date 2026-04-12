// 🧠 XENTARI — TASK GENERATOR (DETERMINISTIC)
// Usage: node xentari-task-generator.js

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

/**
 * 🧠 PROJECT DEFINITION (EDIT ONLY THIS SECTION)
 */
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

/**
 * ⚙️ TASK GENERATION LOGIC
 */
function generateTasks(def) {
  const tasks = [];
  let step = 1;

  // 1. INIT PROJECT
  tasks.push(
    createTask(
      `${pad(step++)}_init_project`,
      'src/index.js',
      'Initialize express server with basic setup',
      [
        'must use express',
        'must listen on port 3000',
        'must export app or server'
      ]
    )
  );

  // 2. CORE CONFIG (optional but useful)
  tasks.push(
    createTask(
      `${pad(step++)}_config`,
      'src/core/config/app.config.js',
      'Create basic app configuration (port, env)',
      ['no external libraries']
    )
  );

  // 3. MODULE TASKS
  for (const mod of def.modules) {
    const base = `src/modules/${mod.name}`;

    // MODEL
    tasks.push(
      createTask(
        `${pad(step++)}_${mod.name}_model`,
        `${base}/${mod.name}.model.js`,
        `Create ${mod.name} model with fields: ${mod.fields.join(', ')}`,
        [
          'no database',
          'pure JS structure',
          'must export factory or object'
        ]
      )
    );

    // SERVICE
    tasks.push(
      createTask(
        `${pad(step++)}_${mod.name}_service`,
        `${base}/${mod.name}.service.js`,
        `Create ${mod.name} service with basic CRUD logic`,
        [
          'no HTTP handling',
          'use in-memory storage',
          'must import model'
        ]
      )
    );

    // CONTROLLER
    tasks.push(
      createTask(
        `${pad(step++)}_${mod.name}_controller`,
        `${base}/${mod.name}.controller.js`,
        `Create ${mod.name} controller to handle requests`,
        [
          'must call service',
          'must return JSON',
          'no business logic inside controller'
        ]
      )
    );

    // ROUTES
    tasks.push(
      createTask(
        `${pad(step++)}_${mod.name}_routes`,
        `${base}/${mod.name}.routes.js`,
        `Create express routes for ${mod.name}`,
        [
          'must use express router',
          'must import controller',
          'define CRUD endpoints'
        ]
      )
    );
  }

  return tasks;
}

/**
 * 🧾 WRITE TASKS + PLAN + STATE
 */
function run() {
  ensureDir(XENTARI_DIR);
  ensureDir(TASK_DIR);

  const tasks = generateTasks(projectDefinition);

  // WRITE TASK FILES
  tasks.forEach((task) => {
    const fileName = `${task.id}.json`;
    const filePath = path.join(TASK_DIR, fileName);
    writeJSON(filePath, task);
  });

  // WRITE PLAN
  const plan = {
    project: projectDefinition.project,
    steps: tasks.map((t) => t.id)
  };

  writeJSON(path.join(XENTARI_DIR, 'plan.json'), plan);

  // WRITE STATE (if not exists)
  const statePath = path.join(XENTARI_DIR, 'state.json');

  if (!fs.existsSync(statePath)) {
    writeJSON(statePath, {
      current_step: tasks[0]?.id || null,
      completed: []
    });
  }

  console.log('✅ Xentari tasks generated');
  console.log(`📦 Total tasks: ${tasks.length}`);
  console.log('📁 Location: xentari/tasks/');
}

run();
