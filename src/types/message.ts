import type { TabEvent } from './tab_event.js';

export type Message = {
    type: MessageType;
    tabId?: number;
    payload?: TabEvent;
};

export enum MessageType {
    JsCookieSet = 'js-cookie-set',
    Click = 'click',
    GetSession = 'get-session',
    GetSessionData = 'get-session-data',
    RestartSession = 'restart-session'
}
