import type { CookieData } from './cookie-data.js';
import type { TabEvent } from './tab_event.js';

/**
 * In-memory representation of an active (or finished) measurement session.
 */
export type Session = {
    sessionId: string;
    tabId: number;
    measurementActive: boolean;
    t0: number;
    events?: TabEvent[];
    url: string;
    cookies?: Map<string, CookieData>;
};

export type TransferableSession = Session & {
    cookies?: CookieData[];
};
