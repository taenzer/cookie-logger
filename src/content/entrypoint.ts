/**
 * Entrypoint UI script for the measurement.
 * Handles user interactions to start a measurement for a given URL and
 * delegates the actual start request to the background script via runtime messages.
 */

import { MessageType, type Message } from '../types/message.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('mForm')! as HTMLFormElement;
    const startBtn = document.getElementById('startBtn')!;
    const siteList = document.getElementById('siteList')! as HTMLSelectElement;
    const url = document.getElementById('url')! as HTMLInputElement;

    startBtn.addEventListener('click', startMeasurement);
    siteList.addEventListener('change', loadUrl);

    /**
     * Handle the Start button click: validate form and send StartMeasurement message.
     */
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

    /**
     * Advance the site select element to the next option (wraps around).
     */
    function selectNextUrl() {
        if (siteList.selectedIndex + 1 < siteList.options.length) {
            siteList.selectedIndex = (siteList.selectedIndex + 1) % siteList.options.length;
            siteList.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    /**
     * Load the currently selected site into the URL input field.
     */
    function loadUrl() {
        url.value = siteList.value;
    }

    /**
     * Return the active tab id in the current window.
     * Throws if no active tab is found.
     */
    async function getActiveTabId(): Promise<number> {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (typeof tabId !== 'number') throw new Error('No active tab found.');
        return tabId;
    }
});
