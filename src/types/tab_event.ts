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
    CookieChanged = 'cookie-changed',
    SessionStart = 'session-started',
    SetCookieViaHeader = 'set-cookie-via-header',
    Click = 'user-click'
}
