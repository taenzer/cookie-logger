// ### EVENT LISTENERS

import type { CookieData } from './types/cookie-data.js';
import type { Session } from './types/session.js';
import { TabEventType, type TabEvent } from './types/tab_event.js';

/**
 * Event Listener - Gets fired, when extension icon is clicked
 */
chrome.action.onClicked.addListener((tab) => {
    console.log('Icon clicked!');
    console.log(sessions);
});

/**
 * Event Listener - Gets fired, when tabs are changed
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log(tab.url);
    if (
        changeInfo.status === 'loading' &&
        tab.url &&
        tab.url.startsWith('http')
    ) {
        ensureSession(tabId, tab.url);
    }
});

chrome.cookies.onChanged.addListener((changeInfo) => {
    const { cookie, removed, cause } = changeInfo;
});

chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (details.tabId < 0) return;

        const session = findSession(details.tabId);

        if (session && details.responseHeaders) {
            evaluateHeaders(
                session,
                details.responseHeaders,
                details.url,
                details.timeStamp
            );
        }

        return { responseHeaders: details.responseHeaders };
    },
    { urls: ['http://*/*', 'https://*/*'] },
    ['responseHeaders', 'extraHeaders']
);

// ### FUNCTIONS

function evaluateHeaders(
    session: Session,
    headers: chrome.webRequest.HttpHeader[],
    url: string,
    timeStamp: number
) {
    const setCookieHeaders = headers
        // first, filter for only set-cookie headers
        .filter((h) => h.name && h.name.toLowerCase() === 'set-cookie')
        // get header values
        .map((h) => h.value);

    for (const header of setCookieHeaders) {
        // Try to get name of cookie (first part of header value is name=value;)
        const firstPart: string = header!.split(';')[0] ?? '';
        const eqIndex = firstPart.indexOf('=');
        const name = eqIndex > 0 ? firstPart.slice(0, eqIndex).trim() : null;

        // If name could not be determined, skip header
        if (!name) continue;

        const cookieData: CookieData = {
            name: name
        };

        logEvent(session, {
            sessionId: session.sessionId,
            timestamp: timeStamp,
            type: TabEventType.SetCookieViaHeader,
            url: url,
            meta: {
                cookieData: cookieData
            }
        });
    }
}

function ensureSession(tabId: number, url: string): Session {
    if (!sessions.has(tabId)) {
        const sessionId: string = createSessionId(tabId);
        const timestamp: number = nowMs();

        const newSession: Session = {
            sessionId: sessionId,
            t0: timestamp,
            url: url
        };
        sessions.set(tabId, newSession);

        logEvent(newSession, {
            sessionId: sessionId,
            timestamp: timestamp,
            type: TabEventType.SessionStart,
            url: url
        });
    }

    return sessions.get(tabId)!;
}

function findSession(tabId: number): Session | undefined {
    const session = sessions.get(tabId);
    if (!session) {
        console.warn(
            'Trying to access session  of tab #' +
                tabId +
                ' but no session exists'
        );
        return;
    }
    return session;
}

function logEvent(session: Session, event: TabEvent) {
    if (!session.events) {
        session.events = [];
    }

    session.events.push(event);
}

function nowMs(): number {
    return Date.now();
}

function createSessionId(tabId: number): string {
    return `${tabId}-${nowMs()}-${Math.random().toString(16).slice(2)}`;
}

// ### DATA

const sessions: Map<number, Session> = new Map();
