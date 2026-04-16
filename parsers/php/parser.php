<?php

require __DIR__ . '/vendor/autoload.php';

use PhpParser\Error;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;
use PhpParser\ParserFactory;

class IRVisitor extends NodeVisitorAbstract
{
    public $entities = [];
    private $currentClass = null;
    private $file;

    public function __construct($file)
    {
        $this->file = $file;
    }

    private function getLocation(Node $node) {
        return [
            'start' => ['line' => $node->getStartLine(), 'column' => $node->getStartTokenPos()],
            'end' => ['line' => $node->getEndLine(), 'column' => $node->getEndTokenPos()]
        ];
    }

    private function generateId($type, $name, $line) {
        return strtolower("{$this->file}::{$type}::{$name}::{$line}");
    }

    public function enterNode(Node $node)
    {
        if ($node instanceof Node\Stmt\Class_ || $node instanceof Node\Stmt\Interface_ || $node instanceof Node\Stmt\Trait_) {
            $type = 'class';
            if ($node instanceof Node\Stmt\Interface_) $type = 'interface';
            if ($node instanceof Node\Stmt\Trait_) $type = 'trait';

            $name = (string) $node->name;
            $this->currentClass = $name;

            $entity = [
                'id' => $this->generateId($type, $name, $node->getStartLine()),
                'type' => $type,
                'name' => strtolower($name),
                'location' => $this->getLocation($node),
                'modifiers' => [],
                'params' => [],
                'returns' => ['kind' => 'mixed'],
                'relations' => []
            ];

            if ($node instanceof Node\Stmt\Class_ && $node->extends) {
                $entity['relations'][] = ['type' => 'extends', 'target' => (string)$node->extends];
            }

            foreach ($node->implements ?? [] as $interface) {
                $entity['relations'][] = ['type' => 'implements', 'target' => (string)$interface];
            }

            $this->entities[] = $entity;
        }

        if ($node instanceof Node\Stmt\ClassMethod && $this->currentClass) {
            $methodName = (string) $node->name;
            
            $traverser = new NodeTraverser();
            $relVisitor = new RelationshipVisitor();
            $traverser->addVisitor($relVisitor);
            $traverser->traverse($node->stmts ?? []);

            $modifiers = [];
            if ($node->isPublic()) $modifiers[] = 'public';
            if ($node->isProtected()) $modifiers[] = 'protected';
            if ($node->isPrivate()) $modifiers[] = 'private';
            if ($node->isStatic()) $modifiers[] = 'static';

            $params = [];
            foreach ($node->params as $param) {
                $params[] = [
                    'name' => (string)$param->var->name,
                    'type' => $param->type ? (string)$param->type : 'mixed'
                ];
            }

            $entity = [
                'id' => $this->generateId('method', $methodName, $node->getStartLine()),
                'type' => 'method',
                'name' => strtolower($methodName),
                'location' => $this->getLocation($node),
                'modifiers' => $modifiers,
                'params' => $params,
                'returns' => [
                    'kind' => $relVisitor->relationship ? 'relation' : 'mixed',
                    'relation' => $relVisitor->relationship
                ],
                'relations' => []
            ];

            $this->entities[] = $entity;
        }
    }
}

class RelationshipVisitor extends NodeVisitorAbstract
{
    public $relationship = null;

    public function enterNode(Node $node)
    {
        if ($node instanceof Node\Expr\MethodCall) {
            if ($node->name instanceof Node\Identifier) {
                $name = (string) $node->name;
                switch ($name) {
                    case 'hasMany': $this->relationship = 'has-many'; break;
                    case 'hasOne': $this->relationship = 'has-one'; break;
                    case 'belongsTo': $this->relationship = 'belongs-to'; break;
                    case 'belongsToMany': $this->relationship = 'belongs-to-many'; break;
                }
            }
        }
    }
}

$projectPath = $argv[1] ?? null;
if (!$projectPath) exit(1);

$parser = (new ParserFactory())->createForNewestSupportedVersion();
$projectIR = [];

$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($projectPath));
$files = [];
foreach ($iterator as $file) {
    if ($file->isDir() || $file->getExtension() !== 'php') continue;
    $files[] = $file->getPathname();
}
sort($files);

foreach ($files as $filePath) {
    $relativeFile = str_replace($projectPath . DIRECTORY_SEPARATOR, '', $filePath);
    if (strpos($relativeFile, 'vendor/') === 0 || strpos($relativeFile, 'node_modules/') === 0) continue;

    $fileContent = file_get_contents($filePath);
    $fileIR = [
        'file' => $relativeFile,
        'path' => $filePath,
        'language' => 'php',
        'hash' => sha1($fileContent),
        'entities' => [],
        'errors' => []
    ];

    try {
        $stmts = $parser->parse($fileContent);
        $traverser = new NodeTraverser();
        $visitor = new IRVisitor($relativeFile);
        $traverser->addVisitor($visitor);
        $traverser->traverse($stmts);
        $fileIR['entities'] = $visitor->entities;
    } catch (Error $e) {
        $fileIR['errors'][] = [
            'type' => 'parse-error',
            'message' => $e->getMessage(),
            'location' => ['line' => $e->getStartLine()]
        ];
    }
    
    $projectIR[] = $fileIR;
}

echo json_encode($projectIR, JSON_PRETTY_PRINT);
