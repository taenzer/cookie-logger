// ### EVENT LISTENERS

import type { CookieData } from '../types/cookie-data.js';
import { MessageType, type Message } from '../types/message.js';
import type { Session } from '../types/session.js';
import { TabEventType, type TabEvent } from '../types/tab_event.js';
import { closeAllTabsExcept } from './helper/browser-cleaner.js';
import { categorizeCookie, initCookieDb } from './helper/cookie-db.js';
import { generateCookieSignature } from './helper/cookie-signature.js';

chrome.tabs.onRemoved.addListener((tabId, _) => {
    const session = findSession(tabId);
    if (session) {
        stopMeasurement(session);
    }
});

chrome.action.onClicked.addListener(async (tab) => {
    const session = findSession(tab.id);
    if (session) {
        await chrome.action.setPopup({
            tabId: session.tabId,
            popup: 'assets/popup.html'
        });
        await chrome.action.openPopup();
    } else {
        const entryUrl = chrome.runtime.getURL('assets/entrypoint.html');
        await chrome.tabs.create({ url: entryUrl, active: true });
    }
});

chrome.cookies.onChanged.addListener(async (changeInfo) => {
    const { cookie, removed, cause } = changeInfo;
    const sessions = getActiveSessions();
    if (sessions.length !== 1) return;
    const timestamp = nowMs();

    const session = sessions[0]!;
    const cookieData: CookieData = await parseAndCategorizeCookie(cookie);

    let eventType: TabEventType;
    if (removed) {
        if (cause == 'overwrite') return;
        eventType = TabEventType.CookieRemoved;
        cookieData.removed = true;
    } else {
        eventType = TabEventType.CookieSet;
        cookieData.removed = false;
    }
    const shouldBeLogged: boolean = !session.cookies?.has(cookieData.signature!) || removed;
    persistCookieData(session, cookieData);

    const tabEvent: TabEvent = {
        timestamp: timestamp,
        type: eventType,
        url: session.url,
        meta: {
            cookieData: cookieData
        }
    };

    if (shouldBeLogged) {
        logEvent(session, tabEvent);
    }
});

chrome.runtime.onMessage.addListener(async (msg: Message, sender, sendResponse) => {
    const tabId = sender?.tab?.id ?? msg.tabId;

    if (msg.type == MessageType.StartMeasurement) {
        if (!msg.measurementRequest) return;
        startMeasurement(msg.measurementRequest.url);
        return;
    } else {
        const session = findSession(tabId);
        if (!session) {
            sendResponse();
            return;
        }
        switch (msg.type) {
            case MessageType.GetSessionData:
            case MessageType.GetSession:
                sendResponse({
                    ...session,
                    cookies: session?.cookies?.values().toArray() ?? []
                });
                return;
            case MessageType.RestartMeasurement:
                await restartMeasurement(session);
                break;
            case MessageType.Click:
                if (msg.payload) logEvent(session, msg.payload);
                break;
            case MessageType.StopMeasurement:
                if (msg.payload) logEvent(session, msg.payload);
                stopMeasurement(session);
                break;
        }
        sendResponse();
        return;
    }
});

// ### FUNCTIONS

async function parseAndCategorizeCookie(cookie: chrome.cookies.Cookie): Promise<CookieData> {
    const signature = await generateCookieSignature(cookie);
    const data: CookieData = {
        name: cookie.name,
        domain: cookie.domain,
        signature: signature,
        removed: false
    };
    return categorizeCookie(data);
}

async function restartMeasurement(session: Session) {
    deleteSession(session.tabId);
    await startMeasurement(session.url, session.tabId);
}

async function startMeasurement(url: string, tabId?: number) {
    // If a measurement is still running, dont start another one
    if (getActiveSessions().length !== 0) {
        return;
    }

    await closeAllTabsExcept(tabId);

    let tab: chrome.tabs.Tab;

    if (tabId) {
        tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId, { url: 'about:blank' });
    } else {
        tab = await chrome.tabs.create({
            active: false,
            url: 'about:blank'
        });
    }

    await chrome.browsingData.remove(
        {},
        {
            cookies: true,
            localStorage: true,
            indexedDB: true,
            cacheStorage: true,
            serviceWorkers: true,
            webSQL: true,
            fileSystems: true,
            appcache: true,
            // optional, usually not needed for CMP but harmless for "clean slate":
            cache: true
        }
    );
    await createSession(tab.id!, url);
    await chrome.tabs.update(tab.id, { url: url, active: true });
    await chrome.action.setBadgeText({ tabId: tabId, text: 'REC' });
    await chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: 'red' });
}

function stopMeasurement(session: Session) {
    session.measurementActive = false;
    sessions.set(session.tabId, session);
    chrome.action.setBadgeText({ tabId: session.tabId, text: 'END' });
    chrome.action.setBadgeBackgroundColor({ tabId: session.tabId, color: 'blue' });
}

function persistCookieData(session: Session, cookieData: CookieData) {
    if (!session.cookies) {
        session.cookies = new Map();
    }
    session.cookies.set(cookieData.signature!, cookieData);
}

function markCookieAsRemoved(session: Session, cookieData: CookieData) {
    if (!session.cookies || !session.cookies.has(cookieData.signature!)) return;
    session.cookies.set(cookieData.signature!, {
        ...cookieData,
        removed: true
    });
}

async function createSession(tabId: number, url: string): Promise<Session> {
    const sessionId: string = createSessionId(tabId);
    const timestamp: number = nowMs();

    const newSession: Session = {
        tabId: tabId,
        sessionId: sessionId,
        measurementActive: true,
        t0: timestamp,
        url: url
    };
    sessions.set(tabId, newSession);

    logEvent(newSession, {
        timestamp: timestamp,
        type: TabEventType.SessionStart,
        url: url
    });

    return newSession;
}

function getActiveSessions(): Session[] {
    return (
        sessions
            ?.values()
            .filter((session) => session.measurementActive)
            .toArray() ?? []
    );
}

function findSession(tabId: number | undefined): Session | undefined {
    if (!tabId) return;
    const session = sessions.get(tabId);
    if (!session) {
        console.warn('Trying to access session  of tab #' + tabId + ' but no session exists');
        return;
    }
    return session;
}

function deleteSession(tabId: number): void {
    if (sessions.has(tabId)) {
        sessions.delete(tabId);
    }
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

    await chrome.action.setBadgeText({ text: 'RDY' });
    await chrome.action.setBadgeBackgroundColor({ color: 'green' });
}

// ### DATA

const sessions: Map<number, Session> = new Map();

init();
