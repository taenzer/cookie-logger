/**
 * Popup UI controller.
 *
 * Responsible for loading the current session data from the background script,
 * rendering counts and protocol, handling user actions (restart/stop/export) and
 * updating the small popup UI.
 */

import { CookieCategory, type CookieData } from '../types/cookie-data.js';
import { MessageType, type Message } from '../types/message.js';
import type { TransferableSession } from '../types/session.js';
import { TabEventType, type TabEvent } from '../types/tab_event.js';
import { renderProtocol } from './protocol.js';

let session: TransferableSession;

/**
 * Render the popup UI: refresh session info, cookie counters and protocol view.
 */
async function render() {
    console.log('Rerender started');
    const tabId = await getActiveTabId();
    updateUiSessionId({ tabId: tabId });
    await loadSession();
    if (!(session?.measurementActive ?? false)) {
        disableStopButton();
    }
    displayCookieCount();
    renderProtocol(session?.events ?? []);
}

/**
 * Update cookie counter display grouped by category.
 */
function displayCookieCount() {
    const wrapper = document.getElementById('cookieCounter');
    if (!session || !wrapper) return;
    wrapper.innerHTML = '';

    const grouped = new Map<CookieCategory, CookieData[]>();

    for (const cookieData of session.cookies ?? []) {
        const category: CookieCategory = cookieData.category ?? CookieCategory.Unknown;
        const arr = grouped.get(category) ?? [];
        arr.push(cookieData);
        grouped.set(category, arr);
    }

    if (grouped.size == 0) {
        wrapper.innerHTML = '<i>No Cookies were set (yet)</i>';
        return;
    }

    for (const [category, cookies] of grouped) {
        const counter = document.createElement('div');
        const deletedCookies = cookies.filter((cookie) => cookie.removed);
        counter.innerHTML = `<p>${category}</p><p>${cookies.length - deletedCookies.length} (${deletedCookies.length} removed)</p>`;
        wrapper?.appendChild(counter);
    }
}

/**
 * Load session data from background for the active tab.
 */
async function loadSession() {
    const tabId = await getActiveTabId();
    const resp = await chrome.runtime.sendMessage<Message, TransferableSession>({
        type: MessageType.GetSessionData,
        tabId: tabId
    });

    if (resp == undefined) {
        document.getElementById('error')!.innerHTML =
            '<p>No data found for current tab. Try to reload the page or restart the measurement!</p>';
    } else {
        document.getElementById('error')!.innerHTML = '';
    }

    session = resp;
    updateUiSessionId({ sessionId: resp?.sessionId });
}

/**
 * Restart measurement for current tab (delegates to background).
 */
async function restartSession() {
    const tabId = await getActiveTabId();

    chrome.runtime.sendMessage<Message, void>({
        type: MessageType.RestartMeasurement,
        tabId: tabId
    });
    window.close();
}

/**
 * Stop measurement and export session afterwards.
 */
async function stopSession() {
    const tabId = await getActiveTabId();

    const tabEvent: TabEvent = {
        timestamp: Date.now(),
        type: TabEventType.SessionEnd,
        url: location.href
    };

    await chrome.runtime.sendMessage<Message, void>({
        type: MessageType.StopMeasurement,
        tabId: tabId,
        payload: tabEvent
    });
    render();
    await exportSession();
}

/**
 * Export current session as JSON and trigger download.
 */
async function exportSession() {
    await loadSession();
    const json = JSON.stringify(session, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    chrome.downloads
        .download({
            url: url,
            filename: `${session.sessionId}-cookie-log.json`,
            saveAs: true
        })
        .catch(() => {})
        .finally(() => {
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
        });
}

/**
 * Get the active tab id in current window.
 */
async function getActiveTabId(): Promise<number> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (typeof tabId !== 'number') throw new Error('No active tab found.');
    return tabId;
}

/**
 * Disable the stop button when the session is already ended.
 */
function disableStopButton() {
    const btn = document.getElementById('endButton') as HTMLInputElement;
    if (!btn) return;

    btn.innerText = 'Session ended';
    btn.disabled = true;
}

/**
 * Update the UI element that shows the session id / tab id.
 */
function updateUiSessionId(data: { sessionId?: string; tabId?: number }) {
    const wrap = document.getElementById('sessionId');
    if (!wrap) return;

    if (data.sessionId) {
        const fragments = data.sessionId.split('-');
        wrap.innerHTML = `Session-Id: <strong>${fragments[0]}</strong>-${fragments[1]}-${fragments[2]}`;
    } else if (data.tabId) {
        wrap.innerText = `Tab-Id: ${data.tabId}`;
    }
}

/**
 * Copy session id (or tab id fallback) to clipboard and provide visual feedback.
 */
async function copyIdToClipboard() {
    const btn = document.getElementById('copyIdButton');
    const id: string = session ? session.sessionId : (await getActiveTabId()).toString();
    await navigator.clipboard.writeText(id);

    if (!btn) return;
    btn.innerText = 'Copied!';
    btn.classList.add('ok');
    setTimeout(() => {
        btn.classList.remove('ok');
        btn.innerText = 'Copy';
    }, 1_000);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('refreshButton')?.addEventListener('click', render);
    document.getElementById('restartButton')?.addEventListener('click', restartSession);
    document.getElementById('endButton')?.addEventListener('click', stopSession);
    document.getElementById('exportButton')?.addEventListener('click', exportSession);
    document.getElementById('copyIdButton')?.addEventListener('click', copyIdToClipboard);

    render();
});
