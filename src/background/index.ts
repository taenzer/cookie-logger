// ### BACKGROUND - Cookie Logger

/**
 * Background script for the Cookie Logger extension. Listens to tab and cookie events
 * and manages measurement sessions (start/stop) as well as local session event logging.
 */

// Imports (alphabetically sorted)
import { closeAllTabsExcept } from './helper/browser-cleaner.js';
import { categorizeCookie, initCookieDb } from './helper/cookie-db.js';
import { generateCookieSignature } from './helper/cookie-signature.js';
import type { CookieData } from '../types/cookie-data.js';
import { MessageType, type Message } from '../types/message.js';
import type { Session } from '../types/session.js';
import { TabEventType, type TabEvent } from '../types/tab_event.js';

// ### EVENT LISTENERS

/**
 * Tab removal: stop measurement if a session exists for the closed tab.
 */
chrome.tabs.onRemoved.addListener((tabId, _) => {
    const session = findSession(tabId);
    if (session) {
        stopMeasurement(session);
    }
});

/**
 * Action click: open popup for active session or create a new entrypoint tab.
 */
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

/**
 * Cookie changes: only process when exactly one active session exists.
 * Parse cookie -> categorize -> persist -> optionally log.
 */
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

/**
 * Messages from content/popup: start/stop/restart/query the current session.
 */
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

// ### HELPERS & SESSION MANAGEMENT

/**
 * Parse a chrome.cookies.Cookie object to CookieData and perform categorization.
 * @param cookie chrome.cookies.Cookie
 * @returns categorized CookieData (including signature)
 */
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

/**
 * Restart: remove the old session and start a new measurement with the same URL (and optional tabId).
 * @param session Session
 */
async function restartMeasurement(session: Session) {
    deleteSession(session.tabId);
    await startMeasurement(session.url, session.tabId);
}

/**
 * Start a measurement: close other tabs, clear browsing data, create a session and navigate to the target URL.
 * Only starts when no measurement is active.
 * @param url target URL for the measurement
 * @param tabId optional tab id if a tab already exists
 */
async function startMeasurement(url: string, tabId?: number) {
    // If a measurement is already running, don't start another
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
    await chrome.action.setBadgeText({ tabId: tab.id, text: 'REC' });
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: 'red' });
}

/**
 * Stop an active measurement (session) and update the badge.
 * @param session Session
 */
function stopMeasurement(session: Session) {
    session.measurementActive = false;
    sessions.set(session.tabId, session);
    chrome.action.setBadgeText({ tabId: session.tabId, text: 'END' });
    chrome.action.setBadgeBackgroundColor({ tabId: session.tabId, color: 'blue' });
}

/**
 * Persist CookieData in the session map.
 * @param session Session
 * @param cookieData CookieData
 */
function persistCookieData(session: Session, cookieData: CookieData) {
    if (!session.cookies) {
        session.cookies = new Map();
    }
    session.cookies.set(cookieData.signature!, cookieData);
}

/**
 * Mark a stored cookie in the session as removed.
 * @param session Session
 * @param cookieData CookieData
 */
function markCookieAsRemoved(session: Session, cookieData: CookieData) {
    if (!session.cookies || !session.cookies.has(cookieData.signature!)) return;
    session.cookies.set(cookieData.signature!, {
        ...cookieData,
        removed: true
    });
}

/**
 * Create a new session, store it in the map and log a SessionStart event.
 * @param tabId number
 * @param url string
 * @returns Session
 */
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

/**
 * Return all active sessions (measurementActive === true).
 * @returns Session[]
 */
function getActiveSessions(): Session[] {
    return (
        sessions
            ?.values()
            .filter((session) => session.measurementActive)
            .toArray() ?? []
    );
}

/**
 * Find a session by tab id. Returns undefined and logs a warning if not found.
 * @param tabId number | undefined
 * @returns Session | undefined
 */
function findSession(tabId: number | undefined): Session | undefined {
    if (!tabId) return;
    const session = sessions.get(tabId);
    if (!session) {
        console.warn('Trying to access session  of tab #' + tabId + ' but no session exists');
        return;
    }
    return session;
}

/**
 * Delete a session from the map.
 * @param tabId number
 */
function deleteSession(tabId: number): void {
    if (sessions.has(tabId)) {
        sessions.delete(tabId);
    }
}

/**
 * Add an event to the session history.
 * @param session Session
 * @param event TabEvent
 */
function logEvent(session: Session, event: TabEvent) {
    if (!session.events) {
        session.events = [];
    }

    session.events.push(event);
}

/**
 * Helper: current time in milliseconds.
 * @returns number
 */
function nowMs(): number {
    return Date.now();
}

/**
 * Create a unique session id from tab id + timestamp + random part.
 * @param tabId number
 * @returns string
 */
function createSessionId(tabId: number): string {
    return `${tabId}-${nowMs()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Initialization: prepare cookie DB and set badge to RDY.
 */
async function init() {
    await initCookieDb();

    await chrome.action.setBadgeText({ text: 'RDY' });
    await chrome.action.setBadgeBackgroundColor({ color: 'green' });
}

// ### DATA

/**
 * In-memory sessions store: map from tabId -> Session
 */
const sessions: Map<number, Session> = new Map();

init();
