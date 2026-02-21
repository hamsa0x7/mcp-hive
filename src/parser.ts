import { parse } from '@babel/parser';

export interface ParseResult {
    functions: string[];
    classes: string[];
}

export function parseSymbols(code: string): ParseResult {
    const result: ParseResult = {
        functions: [],
        classes: []
    };

    try {
        const ast = parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx']
        });

        for (const node of ast.program.body) {
            if (node.type === 'FunctionDeclaration' && node.id?.name) {
                result.functions.push(node.id.name);
            } else if (node.type === 'ClassDeclaration' && node.id?.name) {
                result.classes.push(node.id.name);
            } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
                if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id?.name) {
                    result.functions.push(node.declaration.id.name);
                } else if (node.declaration.type === 'ClassDeclaration' && node.declaration.id?.name) {
                    result.classes.push(node.declaration.id.name);
                }
            }
        }
    } catch (error) {
        // Return empty results on parse error for now, as per ultra-thin resilience
    }

    return result;
}
