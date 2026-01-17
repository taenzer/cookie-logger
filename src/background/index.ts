// ### EVENT LISTENERS

import type { CookieData } from '../types/cookie-data.js';
import { MessageType, type Message } from '../types/message.js';
import type { Session } from '../types/session.js';
import { TabEventType, type TabEvent } from '../types/tab_event.js';
import { categorizeCookie, initCookieDb } from './helper/cookie-db.js';
import { parseCookieHeader } from './helper/cookie-parser.js';

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
    // console.log('COOKIE CHANGE', cookie);
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

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
    if (msg.type == MessageType.GetSessionData) {
        const session = findSession(msg.tabId!);
        if (session) {
            sendResponse({
                ...session,
                cookies: session?.cookies?.values().toArray() ?? []
            });
            console.log(session);
        } else {
            sendResponse();
        }
        return true;
    }

    const tabId = sender?.tab?.id;
    if (!tabId) return;

    if (msg.type == MessageType.GetSession) {
        const session = ensureSession(tabId, sender.tab?.url ?? 'undef');
        sendResponse(session);
        return true;
    }

    const session = findSession(tabId);
    if (!session || !msg.payload) return;

    logEvent(session, msg.payload);
});

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
        if (!header) continue;

        const cookieData: CookieData | null = registerCookie(session, header);

        if (!cookieData) continue;

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

function registerCookie(session: Session, header: string): CookieData | null {
    let cookieData = parseCookieHeader(header);

    // If the header could be parsed, try to categorize the cookie
    if (cookieData) {
        cookieData = categorizeCookie(cookieData);
        if (!session.cookies) {
            session.cookies = new Map();
        }
        session.cookies.set(cookieData.signature!, cookieData);
    }

    return cookieData;
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
        chrome.action.setBadgeText({
            text: 'REC',
            tabId: tabId
        });

        chrome.action.setBadgeBackgroundColor({
            color: 'red',
            tabId: tabId
        });
    }

    return findSession(tabId)!;
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

async function init() {
    await initCookieDb();

    chrome.action.setBadgeText({
        text: 'RDY'
    });

    chrome.action.setBadgeBackgroundColor({
        color: 'green'
    });
}

// ### DATA

const sessions: Map<number, Session> = new Map();

init();
