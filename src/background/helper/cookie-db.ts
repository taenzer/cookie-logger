import { CookieCategory, type CookieData } from '../../types/cookie-data.js';
import {
    isSubdomainOf,
    normalizeCookieName,
    normalizeDomain,
    wildcardToRegex
} from './general.js';

export type CookieDbEntry = {
    id: string;
    cookie: string;
    domain?: string;
    category?: CookieCategory;
    description?: string;
};

let db: CookieDbEntry[];

export async function initCookieDb() {
    const url = chrome.runtime.getURL('assets/open-cookie-database.json');
    const res = await fetch(url);

    if (!res.ok)
        throw new Error(`Initialization of CookieDB Failed: ${res.status}`);

    const raw = (await res.json()) as Record<string, CookieDbEntry[]>;

    const data: CookieDbEntry[] = Object.values(raw).flat();
    db = data;
}

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

/// Normalizers

/// Scoring

function scoreEntry(
    cookieName: string,
    cookieDomain: string | undefined,
    entry: CookieDbEntry
): { entry: CookieDbEntry; score: number } {
    const entryCookie = normalizeCookieName(entry.cookie);
    if (!entryCookie) return { entry, score: 0 };

    // 1) Cookie-Name Matching
    const nameScore = scoreCookieName(cookieName, entryCookie);
    if (nameScore === 0) return { entry, score: 0 };

    // 2) Domain Matching (falls DB-Domain vorhanden: muss passen)
    const entryDomain = normalizeDomain(entry.domain);

    let domainScore = 0;
    if (entryDomain) {
        if (!cookieDomain) {
            // Input hat keine Domain => schwächerer Treffer möglich, aber nur "low"
            domainScore = 5;
        } else if (cookieDomain === entryDomain) {
            domainScore = 40; // exakt
        } else if (isSubdomainOf(cookieDomain, entryDomain)) {
            domainScore = 25; // parent-domain passt (z.B. foo.example.com vs example.com)
        } else {
            return { entry, score: 0 }; // DB sagt Domain, aber passt nicht
        }
    } else {
        // DB-Eintrag ohne Domain: generischer Treffer
        domainScore = cookieDomain ? 10 : 5;
    }

    // 3) Gesamtscore
    // Name ist wichtiger als Domain, aber Domain macht Confidence hoch.
    const score = nameScore + domainScore;

    return { entry, score };
}

function scoreCookieName(actual: string, pattern: string): number {
    // Exakt (case-insensitive)
    if (actual === pattern) return 60;

    // Optional: Prefix / Wildcard Matching
    // Beispiele:
    //  - pattern "ga_*" matcht "ga_123"
    //  - pattern "_ga" matcht exakt nur oben, nicht als prefix
    if (pattern.includes('*')) {
        const re = wildcardToRegex(pattern);
        if (re.test(actual)) return 45;
    }

    // Prefix-Strategie (konservativ): wenn DB z.B. "__utm" und Cookie "__utma"
    // Nur sinnvoll, wenn ihr so eine DB pflegt. Sonst entfernen.
    if (actual.startsWith(pattern) && pattern.length >= 3) return 30;

    return 0;
}
