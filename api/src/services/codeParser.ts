/// @anchor: Parseur de code source — Extraction de la structure sans envoyer le code brut à l'IA
/// Extrait: classes, fonctions, imports, routes, modèles pour Laravel/PHP et JS/TS.

export interface ParsedFile {
  path: string;
  language: 'php' | 'typescript' | 'javascript' | 'unknown';
  classes: ParsedClass[];
  functions: ParsedFunction[];
  imports: string[];
  exports: string[];
  routes: ParsedRoute[];
  models: ParsedModel[];
}

export interface ParsedClass {
  name: string;
  extends?: string;
  implements: string[];
  methods: string[];
}

export interface ParsedFunction {
  name: string;
  exported: boolean;
  async: boolean;
  params: string[];
}

export interface ParsedRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
}

export interface ParsedModel {
  name: string;
  table?: string;
  fillable: string[];
  relationships: ParsedRelationship[];
}

export interface ParsedRelationship {
  type: 'hasMany' | 'belongsTo' | 'hasOne' | 'belongsToMany';
  target: string;
}

/**
 * Parse un fichier source et extrait sa structure.
 */
export function parseSourceFile(filePath: string, content: string): ParsedFile {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const language = ext === 'php' ? 'php' :
    ext === 'ts' || ext === 'tsx' ? 'typescript' :
    ext === 'js' || ext === 'jsx' ? 'javascript' : 'unknown';

  const result: ParsedFile = {
    path: filePath,
    language,
    classes: [],
    functions: [],
    imports: [],
    exports: [],
    routes: [],
    models: [],
  };

  if (language === 'php') {
    parsePhpFile(content, result);
  } else if (language === 'typescript' || language === 'javascript') {
    parseJsTsFile(content, result);
  }

  return result;
}

/** Parse PHP — extraction des classes Laravel, méthodes, routes, modèles. */
function parsePhpFile(content: string, result: ParsedFile): void {
  // Namespace
  const nsMatch = content.match(/namespace\s+([\w\\]+)\s*;/);
  const ns = nsMatch ? nsMatch[1] : '';

  // use/imports
  const useMatches = content.matchAll(/use\s+([\w\\]+)(?:\s+as\s+(\w+))?\s*;/g);
  for (const m of useMatches) {
    result.imports.push(m[1]);
  }

  // Classes
  const classMatches = content.matchAll(/class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?\s*\{/g);
  for (const m of classMatches) {
    const className = m[1];
    const extendsClass = m[2] || undefined;
    const implementsStr = m[3] || '';
    const implementsList = implementsStr.split(',').map(s => s.trim()).filter(Boolean);

    // Méthodes de la classe
    const methods: string[] = [];
    const classBody = extractBlock(content, m.index + m[0].length - 1);
    const methodMatches = classBody.matchAll(/(?:public|protected|private)\s+(?:static\s+)?function\s+(\w+)\s*\(/g);
    for (const mm of methodMatches) {
      methods.push(mm[1]);
    }

    result.classes.push({ name: className, extends: extendsClass, implements: implementsList, methods });

    // Détecter modèle Eloquent
    if (extendsClass === 'Model' || content.includes('extends Model')) {
      const fillableMatch = classBody.match(/protected\s+\$fillable\s*=\s*\[([^\]]+)\]/);
      const fillable = fillableMatch
        ? fillableMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
        : [];

      const relationships: ParsedRelationship[] = [];
      for (const mm of methodMatches) {
        const methodBody = extractBlock(classBody, classBody.indexOf(`function ${mm[1]}`) + `function ${mm[1]}`.length);
        const hasMany = methodBody.match(/\$this->hasMany\((\w+)::class/);
        const belongsTo = methodBody.match(/\$this->belongsTo\((\w+)::class/);
        const hasOne = methodBody.match(/\$this->hasOne\((\w+)::class/);
        const belongsToMany = methodBody.match(/\$this->belongsToMany\((\w+)::class/);

        if (hasMany) relationships.push({ type: 'hasMany', target: hasMany[1] });
        if (belongsTo) relationships.push({ type: 'belongsTo', target: belongsTo[1] });
        if (hasOne) relationships.push({ type: 'hasOne', target: hasOne[1] });
        if (belongsToMany) relationships.push({ type: 'belongsToMany', target: belongsToMany[1] });
      }

      result.models.push({ name: className, table: ns ? `${ns}_${className.toLowerCase()}` : undefined, fillable, relationships });
    }

    // Détecter contrôleur Laravel
    if (extendsClass?.includes('Controller') || className.endsWith('Controller')) {
      for (const method of methods) {
        if (['index', 'show', 'store', 'update', 'destroy', 'create', 'edit'].includes(method)) {
          const routePath = `/${ns ? ns.replace(/\\/g, '/').toLowerCase() + '/' : ''}${className.replace(/Controller$/i, '').toLowerCase()}`;
          const httpMethod = method === 'index' || method === 'show' ? 'GET' :
            method === 'store' ? 'POST' : method === 'update' ? 'PUT' : 'DELETE';
          result.routes.push({ method: httpMethod, path: `${routePath}${method !== 'index' ? '/:id' : ''}`, handler: `${className}@${method}` });
        }
      }
    }
  }

  // Routes Laravel autonomes
  const routeMatches = content.matchAll(/Route::(\w+)\s*\(\s*['"]([^'"]+)['"]\s*,\s*\[?['"]?([\w@]+)['"]?\]?/g);
  for (const m of routeMatches) {
    const method = m[1].toUpperCase() as ParsedRoute['method'];
    if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      result.routes.push({ method, path: m[2], handler: m[3] });
    }
  }
}

/** Parse JavaScript/TypeScript — extraction des fonctions, classes, imports. */
function parseJsTsFile(content: string, result: ParsedFile): void {
  // imports
  const importMatches = content.matchAll(/import\s+(?:\{[^}]+\}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g);
  for (const m of importMatches) {
    result.imports.push(m[1]);
  }
  const requireMatches = content.matchAll(/(?:const|let|var)\s+(?:\{[^}]+\}|[\w]+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of requireMatches) {
    result.imports.push(m[1]);
  }

  // exports
  const exportMatches = content.matchAll(/export\s+(?:const|function|class|default|interface|type)\s+(\w+)/g);
  for (const m of exportMatches) {
    result.exports.push(m[1]);
  }

  // Fonctions
  const funcMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g);
  for (const m of funcMatches) {
    result.functions.push({
      name: m[1],
      exported: content.slice(Math.max(0, m.index - 10), m.index).includes('export'),
      async: content.slice(Math.max(0, m.index - 15), m.index).includes('async'),
      params: m[2].split(',').map(p => p.trim()).filter(Boolean),
    });
  }

  // Arrow functions (const nom = () => {...})
  const arrowMatches = content.matchAll(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g);
  for (const m of arrowMatches) {
    result.functions.push({
      name: m[1],
      exported: content.slice(Math.max(0, m.index - 10), m.index).includes('export'),
      async: content.slice(m.index, m.index + m[0].length).includes('async'),
      params: m[2].split(',').map(p => p.trim()).filter(Boolean),
    });
  }

  // Classes
  const classMatches = content.matchAll(/(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?\s*\{/g);
  for (const m of classMatches) {
    const className = m[1];
    const extendsClass = m[2] || undefined;
    const classBody = extractBlock(content, m.index + m[0].length - 1);
    const methodMatches = classBody.matchAll(/(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{/g);
    const methods: string[] = [];
    for (const mm of methodMatches) {
      if (!['if', 'for', 'while', 'switch', 'catch'].includes(mm[1])) {
        methods.push(mm[1]);
      }
    }
    result.classes.push({ name: className, extends: extendsClass, implements: [], methods });
  }

  // Interfaces/types TypeScript
  const intMatches = content.matchAll(/(?:export\s+)?(?:interface|type)\s+(\w+)/g);
  for (const m of intMatches) {
    if (!result.functions.find(f => f.name === m[1])) {
      result.functions.push({ name: m[1], exported: true, async: false, params: [] });
    }
  }
}

/** Extrait le contenu entre accolades (gère l'imbrication). */
function extractBlock(content: string, startIndex: number): string {
  let depth = 0;
  let started = false;
  let result = '';
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') { depth++; started = true; }
    else if (content[i] === '}') { depth--; if (started && depth === 0) break; }
    if (started) result += content[i];
  }
  return result;
}
