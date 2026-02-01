/**
 * Cookie DB utilities
 *
 * Loads a JSON cookie database and provides a best-effort categorization function
 * that scores candidate DB entries against an observed cookie name and domain.
 */

import { CookieCategory, type CookieData } from '../../types/cookie-data.js';
import { isSubdomainOf, normalizeCookieName, normalizeDomain, wildcardToRegex } from './general.js';

/**
 * Single entry in the external cookie database.
 */
export type CookieDbEntry = {
    id: string;
    cookie: string;
    domain?: string;
    category?: CookieCategory;
    description?: string;
};

// In-memory DB after initialization
let db: CookieDbEntry[];

/**
 * Initialize the cookie DB by loading the JSON asset shipped with the extension.
 * Throws if fetch fails.
 */
export async function initCookieDb() {
    const url = chrome.runtime.getURL('assets/open-cookie-database.json');
    const res = await fetch(url);

    if (!res.ok) throw new Error(`Initialization of CookieDB Failed: ${res.status}`);

    const raw = (await res.json()) as Record<string, CookieDbEntry[]>;

    const data: CookieDbEntry[] = Object.values(raw).flat();
    db = data;
}

/**
 * Categorize an observed cookie using the local DB.
 * Returns the input CookieData enriched with category, confidence and the matched DB entry (if any).
 */
export function categorizeCookie(input: CookieData): CookieData {
    if (db == undefined || !db) {
        input.category = CookieCategory.Unknown;
        input.confidence = 'low';
        return input;
    }

    const name = normalizeCookieName(input.name);
    const domain = normalizeDomain(input.domain);

    if (!name) {
        return {
            ...input,
            category: CookieCategory.Unknown,
            confidence: 'low'
        };
    }

    const candidates = db
        .map((e) => scoreEntry(name, domain, e))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

    const best = candidates[0];
    if (!best) {
        return {
            ...input,
            category: CookieCategory.Unknown,
            confidence: 'low'
        };
    }

    const bestScore = best.score;
    const confidence: 'high' | 'medium' | 'low' =
        bestScore >= 90 ? 'high' : bestScore >= 60 ? 'medium' : 'low';

    return {
        ...input,
        cookieDbEntry: best.entry,
        category: best.entry.category ?? CookieCategory.Unknown,
        confidence: confidence
    };
}

/**
 * Score how well a DB entry matches an observed cookie name and domain.
 * A zero score means "no match". The returned object contains the original entry
 * and the computed numerical score.
 */
function scoreEntry(
    cookieName: string,
    cookieDomain: string | undefined,
    entry: CookieDbEntry
): { entry: CookieDbEntry; score: number } {
    const entryCookie = normalizeCookieName(entry.cookie);
    if (!entryCookie) return { entry, score: 0 };

    // 1) Cookie name matching — if name doesn't match at all, this entry is ignored
    const nameScore = scoreCookieName(cookieName, entryCookie);
    if (nameScore === 0) return { entry, score: 0 };

    // 2) Domain matching — when the DB entry specifies a domain, it must be compatible
    const entryDomain = normalizeDomain(entry.domain);

    let domainScore = 0;
    if (entryDomain) {
        if (!cookieDomain) {
            // Observed cookie has no domain information -> weaker match
            domainScore = 5;
        } else if (cookieDomain === entryDomain) {
            domainScore = 40; // exact domain match
        } else if (isSubdomainOf(cookieDomain, entryDomain)) {
            domainScore = 25; // cookie domain is a subdomain of DB domain
        } else {
            return { entry, score: 0 }; // DB requires a specific domain that doesn't match
        }
    } else {
        // DB entry without a domain is a generic match
        domainScore = cookieDomain ? 10 : 5;
    }

    const score = nameScore + domainScore;

    return { entry, score };
}

/**
 * Score cookie name matching between an observed name and a DB pattern.
 * Returns a numeric score (higher is better). Uses exact match, wildcard patterns
 * and a conservative prefix heuristic.
 */
function scoreCookieName(actual: string, pattern: string): number {
    // Exact match
    if (actual === pattern) return 60;

    // Wildcard matching (pattern contains '*')
    if (pattern.includes('*')) {
        const re = wildcardToRegex(pattern);
        if (re.test(actual)) return 45;
    }

    // Conservative prefix strategy: useful for DB entries like "__utm" and cookies like "__utma"
    // Only apply when the pattern is at least 3 characters long.
    if (actual.startsWith(pattern) && pattern.length >= 3) return 30;

    return 0;
}
