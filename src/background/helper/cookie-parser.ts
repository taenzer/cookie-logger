import type { CookieData } from '../../types/cookie-data.js';
import {
    normalizeDomain,
    normalizePath,
    normalizeSameSite
} from './general.js';

export type ParsingResult = {
    name?: string;
    domain?: string | undefined;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'lax' | 'strict' | 'none' | 'unspecified';
    expires?: string | undefined;
    maxAge?: string | undefined;
};

export function parseCookieHeader(header: string): CookieData | null {
    const input = header.trim();
    const parts = input
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);

    if (!parts || parts.length === 0) {
        return null;
    }

    const parseResult = parseHeaderParts(parts);

    if (!parseResult.name) return null;

    const cookieData: CookieData = {
        name: parseResult.name,
        domain: parseResult.domain,
        signature: buildCookieSignatureId(parseResult)
    };

    return cookieData;
}

function parseHeaderParts(parts: string[]): ParsingResult {
    const firstPart: string = parts[0]!;
    const eqIndex = firstPart.indexOf('=');

    const name = firstPart.slice(0, eqIndex).trim();
    // If name could not be determined, skip
    if (!name) return {};

    let domain: string | undefined;
    let path: string | undefined;
    let secure = false;
    let httpOnly = false;
    let sameSite: ParsingResult['sameSite'];
    let expires: string | undefined;
    let maxAge: string | undefined;

    for (let i = 1; i < parts.length; i++) {
        const segment = parts[i]!;
        const lower = segment.toLowerCase();

        // Flag attributes (no "=")
        if (lower === 'secure') {
            secure = true;
            continue;
        }
        if (lower === 'httponly') {
            httpOnly = true;
            continue;
        }

        const eqIndex = segment.indexOf('=');
        if (!eqIndex || eqIndex === -1) continue;

        const key = segment.slice(0, eqIndex).trim().toLowerCase();
        const value = segment.slice(eqIndex + 1).trim();

        switch (key) {
            case 'domain': {
                domain = normalizeDomain(value);
                break;
            }
            case 'path': {
                path = normalizePath(value);
                break;
            }
            case 'samesite': {
                sameSite = normalizeSameSite(value);
                break;
            }
            case 'expires': {
                // keep raw for UI/debug; NOT used for id
                expires = value;
                break;
            }
            case 'max-age': {
                maxAge = value;
                break;
            }
            default:
                break;
        }
    }

    return {
        name: name,
        domain: domain,
        path: path ?? '/',
        secure: secure,
        httpOnly: httpOnly,
        sameSite: sameSite ?? 'unspecified',
        expires: expires,
        maxAge: maxAge
    };
}

function buildCookieSignatureId(parsed: ParsingResult): string {
    const name = (parsed.name ?? '').trim().toLowerCase();
    const domain = normalizeDomain(parsed.domain) ?? ''; // empty if unknown
    const path = normalizePath(parsed.path) ?? '/';
    const secure = parsed.secure ? '1' : '0';
    const httpOnly = parsed.httpOnly ? '1' : '0';
    const sameSite = parsed.sameSite ?? 'unspecified';

    // Format is intentionally stable and human-readable for debugging.
    return `${name}|${domain}|${path}|s=${secure}|h=${httpOnly}|ss=${sameSite}`;
}
