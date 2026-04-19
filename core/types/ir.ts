export type EntityType = "class" | "function" | "method" | "endpoint" | "trait" | "interface";
export type Modifier = "public" | "private" | "protected" | "static" | "abstract" | "final";
export type RelationType = "calls" | "references" | "extends" | "implements" | "uses";
export type ReturnKind = "string" | "number" | "boolean" | "void" | "mixed" | "relation";
export type LaravelRelation = "has-many" | "has-one" | "belongs-to" | "belongs-to-many";

export interface Location {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface Parameter {
  name: string;
  type: string;
}

export interface Relation {
  type: RelationType;
  target: string; // entity_id
}

export interface Entity {
  id: string; // file::type::name::startLine
  type: EntityType;
  name: string;
  location: Location;
  modifiers: Modifier[];
  params: Parameter[];
  returns: {
    kind: ReturnKind;
    relation?: LaravelRelation;
  };
  relations: Relation[];
}

export interface ParseError {
  type: "parse-error";
  message: string;
  location: { line: number };
}

export interface FileIR {
  file: string;
  path: string;
  language: "php" | "js" | "ts" | "python";
  hash: string;
  entities: Entity[];
  errors: ParseError[];
}

export type ProjectIR = FileIR[];
