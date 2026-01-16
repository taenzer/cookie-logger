import type { ParsingResult } from './cookie-parser.js';

export function normalizeCookieName(name?: string): string {
    return (name ?? '').trim().toLowerCase();
}

export function normalizeDomain(domain?: string): string {
    if (!domain) return '';
    let d = domain.trim().toLowerCase();

    // remove leading . (".example.com" -> "example.com")
    while (d.startsWith('.')) d = d.slice(1);

    // clear schema
    d = d.replace(/^https?:\/\//, '');
    d = d.split('/')[0] ?? '';

    return d || '';
}

export function normalizePath(path?: string): string | undefined {
    if (!path) return undefined;
    let p = path.trim();
    if (!p) return undefined;
    if (!p.startsWith('/')) p = '/' + p;
    return p;
}

export function normalizeSameSite(v: string): ParsingResult['sameSite'] {
    const s = (v ?? '').trim().toLowerCase();
    if (s === 'lax') return 'lax';
    if (s === 'strict') return 'strict';
    if (s === 'none') return 'none';
    return 'unspecified';
}

export function isSubdomainOf(child: string, parent: string): boolean {
    if (child === parent) return true;
    return child.endsWith('.' + parent);
}

export function wildcardToRegex(pattern: string): RegExp {
    // Escape regex specials exept *
    const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
    const reStr = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(reStr, 'i');
}

export function trimWrappingQuotes(input: string): string {
    if (
        (input.startsWith('"') && input.endsWith('"')) ||
        (input.startsWith("'") && input.endsWith("'"))
    ) {
        input = input.slice(1, -1);
    }
    return input;
}
