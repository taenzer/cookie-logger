import type { CookieData } from './cookie-data.js';

export type TabEvent = {
    type: TabEventType;
    url: string;
    sessionId: string;
    timestamp: number;
    meta?: TabEventMeta;
};

export type TabEventMeta = {
    cookieData?: CookieData;
    clickData?: {
        cssSelector?: string;
        text?: string;
        mouseButton?: number;
    };
};

export enum TabEventType {
    CookieSet = 'cookie-set',
    CookieRemoved = 'cookie-removed',
    SessionStart = 'session-started',
    SessionEnd = 'session-ended',
    Click = 'user-click'
}
