<?php

require __DIR__ . '/vendor/autoload.php';

use PhpParser\Error;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;
use PhpParser\ParserFactory;
use PhpParser\PrettyPrinter;
use PhpParser\Node\Stmt\Class_;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Expr\New_;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PhpParser\Lexer\Emulative;

class RefactorVisitor extends NodeVisitorAbstract {
    private $op;
    private $targetClass;
    private $targetSymbol;
    private $newName;
    private $methodTemplate;
    private $currentClass = null;
    private $found = false;

    public function __construct($op, $targetClass, $targetSymbol, $newName = null, $methodTemplate = null) {
        $this->op = $op;
        $this->targetClass = $targetClass ? strtolower($targetClass) : null;
        $this->targetSymbol = $targetSymbol ? strtolower($targetSymbol) : null;
        $this->newName = $newName;
        $this->methodTemplate = $methodTemplate;
    }

    public function enterNode(Node $node) {
        if ($node instanceof Class_) {
            $this->currentClass = (string)$node->name;
            
            // Rename Class Definition
            if ($this->op === 'renameClass' && strtolower($this->currentClass) === $this->targetClass) {
                $node->name = new Identifier($this->newName);
                $this->found = true;
            }
        }

        // Rename Method Definition
        if ($this->op === 'renameMethod' && $node instanceof ClassMethod) {
            if ($this->targetClass && strtolower($this->currentClass) === $this->targetClass) {
                if (strtolower((string)$node->name) === $this->targetSymbol) {
                    $node->name = new Identifier($this->newName);
                    $this->found = true;
                }
            }
        }

        // Rename Internal Method Calls ($this->foo())
        if ($this->op === 'renameMethod' && $node instanceof MethodCall) {
            if ($this->targetClass && strtolower($this->currentClass) === $this->targetClass && $node->var instanceof Node\Expr\Variable && $node->var->name === 'this') {
                if ($node->name instanceof Identifier && strtolower((string)$node->name) === $this->targetSymbol) {
                    $node->name = new Identifier($this->newName);
                }
            }
        }

        // Rename Class references (New, StaticCall)
        if ($this->op === 'renameClass') {
            if ($node instanceof New_ && $node->class instanceof Name) {
                if (strtolower((string)$node->class) === $this->targetClass) {
                    $node->class = new Name($this->newName);
                }
            }
            if ($node instanceof StaticCall && $node->class instanceof Name) {
                if (strtolower((string)$node->class) === $this->targetClass) {
                    $node->class = new Name($this->newName);
                }
            }
        }

        // Remove Method
        if ($this->op === 'removeMethod' && $node instanceof Class_) {
            if (strtolower((string)$node->name) === $this->targetClass) {
                $newStmts = [];
                foreach ($node->stmts as $stmt) {
                    if ($stmt instanceof ClassMethod && strtolower((string)$stmt->name) === $this->targetSymbol) {
                        $this->found = true;
                        continue;
                    }
                    $newStmts[] = $stmt;
                }
                $node->stmts = $newStmts;
            }
        }
    }

    public function leaveNode(Node $node) {
        if ($node instanceof Class_) {
            // Add Method (sorted)
            if ($this->op === 'addMethod' && strtolower((string)$node->name) === $this->targetClass) {
                $parser = (new ParserFactory())->createForNewestSupportedVersion();
                try {
                    $newMethodStmts = $parser->parse("<?php class T { " . $this->methodTemplate . " }");
                    $newMethodNode = $newMethodStmts[0]->stmts[0];
                    
                    if ($newMethodNode instanceof ClassMethod) {
                        $node->stmts[] = $newMethodNode;
                        
                        // Sort methods alphabetically by name
                        usort($node->stmts, function($a, $b) {
                            if ($a instanceof ClassMethod && $b instanceof ClassMethod) {
                                return strcmp(strtolower((string)$a->name), strtolower((string)$b->name));
                            }
                            // Keep non-method statements at their relative positions (simplified)
                            return 0;
                        });
                        $this->found = true;
                    }
                } catch (Error $e) {}
            }
            $this->currentClass = null;
        }
    }

    public function isFound() {
        return $this->found;
    }
}

// Minimal JSON-based interface
$input = json_decode(file_get_contents('php://stdin'), true);
if (!$input) exit(1);

$filePath = $input['file'];
$op = $input['op'];
$targetClass = $input['class'] ?? null;
$targetSymbol = $input['target'] ?? null;
$newName = $input['newName'] ?? null;
$methodTemplate = $input['template'] ?? null;

if (!file_exists($filePath)) {
    echo json_encode(['error' => 'File not found']);
    exit(1);
}

$parser = (new ParserFactory())->createForNewestSupportedVersion();
$traverser = new NodeTraverser();
$visitor = new RefactorVisitor($op, $targetClass, $targetSymbol, $newName, $methodTemplate);
$traverser->addVisitor($visitor);

try {
    $code = file_get_contents($filePath);
    $oldStmts = $parser->parse($code);
    $newStmts = $traverser->traverse($oldStmts);

    if (!$visitor->isFound()) {
        echo json_encode(['error' => 'Symbol not found or ambiguous']);
        exit(0);
    }

    $printer = new PrettyPrinter\Standard();
    $newCode = $printer->prettyPrintFile($newStmts);

    echo json_encode(['file' => $filePath, 'content' => $newCode]);
} catch (Error $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
