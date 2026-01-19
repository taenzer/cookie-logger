import { MessageType, type Message } from '../types/message.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('mForm')! as HTMLFormElement;
    const startBtn = document.getElementById('startBtn')!;
    const siteList = document.getElementById('siteList')! as HTMLSelectElement;
    const url = document.getElementById('url')! as HTMLInputElement;

    startBtn.addEventListener('click', startMeasurement);
    siteList.addEventListener('change', loadUrl);

    async function startMeasurement(event: MouseEvent) {
        event.preventDefault();
        form.checkValidity();
        form.reportValidity();

        const urlValue = url.value;
        const tabId = await getActiveTabId();
        chrome.runtime.sendMessage<Message, void>({
            type: MessageType.StartMeasurement,
            measurementRequest: {
                url: urlValue,
                keepTabId: tabId
            }
        });
        selectNextUrl();
    }

    function selectNextUrl() {
        if (siteList.selectedIndex + 1 < siteList.options.length) {
            siteList.selectedIndex = (siteList.selectedIndex + 1) % siteList.options.length;
            siteList.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function loadUrl() {
        url.value = siteList.value;
    }

    async function getActiveTabId(): Promise<number> {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (typeof tabId !== 'number') throw new Error('No active tab found.');
        return tabId;
    }
});
