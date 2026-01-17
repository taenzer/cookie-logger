import { CookieCategory, type CookieData } from '../types/cookie-data.js';
import { MessageType, type Message } from '../types/message.js';
import type { TransferableSession } from '../types/session.js';
import { renderProtocol } from './protocol.js';

let session: TransferableSession;

async function render() {
    console.log('Rerender started');
    document.getElementById('tabId')!.innerHTML = (
        await getActiveTabId()
    ).toString();
    await loadSession();
    displayCookieCount();
    renderProtocol(session?.events ?? []);

    document.getElementById('refreshButton')?.addEventListener('click', render);
}

function displayCookieCount() {
    const wrapper = document.getElementById('cookieCounter');
    if (!session || !wrapper) return;
    wrapper.innerHTML = '';

    const grouped = new Map<CookieCategory, CookieData[]>();

    for (const cookieData of session.cookies ?? []) {
        const category: CookieCategory =
            cookieData.category ?? CookieCategory.Unknown;
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
    const resp = await chrome.runtime.sendMessage<Message, TransferableSession>(
        {
            type: MessageType.GetSessionData,
            tabId: tabId
        }
    );

    if (resp == undefined) {
        document.getElementById('error')!.innerHTML =
            '<p>No data found for current tab. Try to reload the page or restart the measurement!</p>';
    } else {
        document.getElementById('error')!.innerHTML = '';
    }

    session = resp;
}

async function getActiveTabId(): Promise<number> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (typeof tabId !== 'number') throw new Error('No active tab found.');
    return tabId;
}

render();
