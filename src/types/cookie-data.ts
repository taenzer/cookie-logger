import type { CookieDbEntry } from '../background/helper/cookie-db.js';

export type CookieData = {
    signature?: string;
    name?: string;
    domain?: string | undefined;
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
