import type { CookieDbEntry } from '../background/helper/cookie-db.js';

/**
 * Data structure that represents a cookie observed during a session.
 */
export type CookieData = {
    signature?: string;
    name?: string;
    domain?: string | undefined;
    removed: boolean;
    category?: CookieCategory;
    confidence?: 'high' | 'medium' | 'low';
    cookieDbEntry?: CookieDbEntry;
};

export enum CookieCategory {
    Functional = 'Functional',
    Analytics = 'Analytics',
    Marketing = 'Marketing',
    Security = 'Security',
    Personalization = 'Personalization',
    Necessary = 'Necessary',
    Unknown = 'Unknown'
}
