import type { CookieData } from './cookie-data.js';

/**
 * Represents an event that occurred in a tracked browser tab.
 */
export type TabEvent = {
    type: TabEventType;
    url: string;
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

/**
 * Enum for the different types of events that can occur in a tracked browser tab.
 */
export enum TabEventType {
    CookieSet = 'cookie-set',
    CookieRemoved = 'cookie-removed',
    SessionStart = 'session-started',
    SessionEnd = 'session-ended',
    Click = 'user-click'
}
