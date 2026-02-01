/**
 * Content script: capture user clicks inside the page and forward lightweight
 * events to the background script. The script also fetches the current session
 * from the background on init so events are only sent while a session is active.
 */

import { MessageType, type Message } from '../types/message.js';
import type { Session } from '../types/session.js';
import { TabEventType, type TabEvent } from '../types/tab_event.js';

/** Current session received from the background script. */
let session: Session;

/** Event listener options used for reliable click capture. */
const opts: AddEventListenerOptions = { capture: true, passive: true };

// Register global click handler
document.addEventListener('click', clickHandler, opts);

/**
 * Handle click events and forward a TabEvent to the background when a session exists.
 * @param event MouseEvent
 */
function clickHandler(event: MouseEvent) {
    if (!session) {
        return;
    }

    const target = event.target;
    const text = (getTargetElementText(target) ?? '').slice(0, 120);

    const tabEvent: TabEvent = {
        timestamp: nowMs(),
        type: TabEventType.Click,
        url: location.href,
        meta: {
            clickData: {
                cssSelector: cssPath(target),
                mouseButton: event.button,
                text: text
            }
        }
    };

    chrome.runtime.sendMessage<Message, any>({
        type: MessageType.Click,
        payload: tabEvent
    });
}

/**
 * Build a short CSS-like path for an element (limited depth).
 * @param input EventTarget | null
 * @returns string css path
 */
function cssPath(input: EventTarget | null): string {
    if (!(input instanceof HTMLElement)) return '';
    if (!input || !input.nodeType || input.nodeType !== 1) return '';
    var element: Element | HTMLElement | null = input;
    const parts = [];
    while (element && element.nodeType === 1 && parts.length < 6) {
        let part = element.nodeName.toLowerCase();
        if (element.id) {
            part += `#${element.id}`;
            parts.unshift(part);
            break;
        }
        if (element.classList && element.classList.length)
            part += '.' + [...element.classList].slice(0, 2).join('.');
        parts.unshift(part);
        element = element.parentElement;
    }
    return parts.join(' > ');
}

/**
 * Extract readable text from a target element.
 * Inputs/Textareas/Selects: use value
 * Buttons/Links/other elements: use innerText
 */
function getTargetElementText(target: EventTarget | null): string | null {
    if (!(target instanceof Element)) return null;

    // Inputs/Textareas/Selects: use value
    if (target instanceof HTMLInputElement) return target.value;
    if (target instanceof HTMLTextAreaElement) return target.value;
    if (target instanceof HTMLSelectElement) return target.value;

    // Buttons/Links/other elements: innerText
    if (target instanceof HTMLElement) {
        return (target.innerText || target.textContent || '').trim();
    }

    return (target.textContent || '').trim();
}

/**
 * Return current epoch time in milliseconds.
 */
function nowMs(): number {
    return Date.now();
}

/**
 * Request the current session object from the background script and store it locally.
 */
async function initSession() {
    session = await chrome.runtime.sendMessage<Message, Session>({
        type: MessageType.GetSession
    });
}

initSession();
