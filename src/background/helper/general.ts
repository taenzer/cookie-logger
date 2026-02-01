/**
 * Normalize cookie name to a lowercased trimmed string.
 */
export function normalizeCookieName(name?: string): string {
    return (name ?? '').trim().toLowerCase();
}

/**
 * Normalize domain: remove leading dots, schema and path, return hostname only.
 */
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

/**
 * Normalize path; ensure leading slash.
 */
export function normalizePath(path?: string): string | undefined {
    if (!path) return undefined;
    let p = path.trim();
    if (!p) return undefined;
    if (!p.startsWith('/')) p = '/' + p;
    return p;
}

/**
 * Returns true if the child domain is equal to or a subdomain of the parent.
 */
export function isSubdomainOf(child: string, parent: string): boolean {
    if (child === parent) return true;
    return child.endsWith('.' + parent);
}

/**
 * Convert a wildcard pattern like 'ga_*' into a case-insensitive RegExp.
 */
export function wildcardToRegex(pattern: string): RegExp {
    // Escape regex specials exept *
    const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
    const reStr = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(reStr, 'i');
}

/**
 * Trim wrapping single or double quotes from the input string.
 */
export function trimWrappingQuotes(input: string): string {
    if (
        (input.startsWith('"') && input.endsWith('"')) ||
        (input.startsWith("'") && input.endsWith("'"))
    ) {
        input = input.slice(1, -1);
    }
    return input;
}
