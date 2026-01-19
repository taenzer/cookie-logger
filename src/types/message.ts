import type { TabEvent } from './tab_event.js';

export type Message = {
    type: MessageType;
    tabId?: number;
    payload?: TabEvent;
    measurementRequest?: MeasurementRequest;
};

export type MeasurementRequest = {
    url: string;
    keepTabId: number;
};

export enum MessageType {
    Click = 'click',
    GetSession = 'get-session',
    GetSessionData = 'get-session-data',
    StartMeasurement = 'start-measurement',
    RestartMeasurement = 'restart-measurement',
    StopMeasurement = 'stop-measurement'
}
