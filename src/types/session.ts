import type { CookieData } from './cookie-data.js';
import type { TabEvent } from './tab_event.js';

export type Session = {
    sessionId: string;
    t0: number;
    events?: TabEvent[];
    url: string;
    cookies?: Map<string, CookieData>;
};

export type TransferableSession = Session & {
    cookies?: CookieData[];
};
