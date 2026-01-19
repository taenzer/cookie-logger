import { CookieCategory, type CookieData } from '../types/cookie-data.js';
import { MessageType, type Message } from '../types/message.js';
import type { TransferableSession } from '../types/session.js';
import { TabEventType, type TabEvent } from '../types/tab_event.js';
import { renderProtocol } from './protocol.js';

let session: TransferableSession;

async function render() {
    console.log('Rerender started');
    document.getElementById('tabId')!.innerHTML = (await getActiveTabId()).toString();
    await loadSession();
    if (!(session?.active ?? false)) {
        disableStopButton();
    }
    displayCookieCount();
    renderProtocol(session?.events ?? []);
}

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
        counter.innerHTML = `<p>${category}</p><p>${cookies.length}</p>`;
        wrapper?.appendChild(counter);
    }
}

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
}

async function restartSession() {
    const tabId = await getActiveTabId();

    chrome.runtime.sendMessage<Message, void>({
        type: MessageType.RestartSession,
        tabId: tabId
    });
    window.close();
}

async function stopSession() {
    const tabId = await getActiveTabId();

    const tabEvent: TabEvent = {
        sessionId: session.sessionId,
        timestamp: Date.now(),
        type: TabEventType.SessionEnd,
        url: location.href
    };

    await chrome.runtime.sendMessage<Message, void>({
        type: MessageType.StopSession,
        tabId: tabId,
        payload: tabEvent
    });
    render();
}

async function exportSession() {
    await loadSession();
    const json = JSON.stringify(session);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    chrome.downloads
        .download({
            url: url,
            filename: 'cookie-log.json',
            saveAs: true
        })
        .catch(() => {})
        .finally(() => {
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
        });
}

async function getActiveTabId(): Promise<number> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (typeof tabId !== 'number') throw new Error('No active tab found.');
    return tabId;
}

function disableStopButton() {
    const btn = document.getElementById('endButton') as HTMLInputElement;
    if (!btn) return;

    btn.innerText = 'Session ended';
    btn.disabled = true;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('refreshButton')?.addEventListener('click', render);
    document.getElementById('restartButton')?.addEventListener('click', restartSession);
    document.getElementById('endButton')?.addEventListener('click', stopSession);
    document.getElementById('exportButton')?.addEventListener('click', exportSession);
    render();
});
