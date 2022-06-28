export const CARD_VERSION = '1.0.11';

export const DOMAIN = 'wiser';

export const DefaultTimeStep = 10;

export const DefaultActionIcon = 'flash';

export const SEC_PER_DAY = 86400;
export const SEC_PER_HOUR = 3600;

export enum ScheduleIcons {
    Heating = "mdi:radiator",
    OnOff = "mdi:power-socket-uk",
    Shutters = "mdi:blinds",
    Lighting = "mdi:lightbulb-outline"
}

export enum EViews {
    Overview = 'OVERVIEW',
    ScheduleEdit = 'SCHEDULE_EDIT',
    ScheduleCopy = 'SCHEDULE_COPY',
    ScheduleAdd = 'SCHEDULE_ADD',
}

export enum DefaultSetpoint {
    Heating = '19',
    OnOff = 'Off',
    Lighting = '0',
    Shutters = '100',
}

export enum SetpointUnits {
    Heating = '°C',
    OnOff = '',
    Lighting = '%',
    Shutters = '%'
}

export const WebsocketEvent = 'scheduler_updated';
export const HEATING_TYPES = ['Heating', 'OnOff', 'Lighting', 'Shutters']

export const weekdays: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const weekends: string[] = ['Saturday', 'Sunday']
export const days: string[] = weekdays.concat(weekends)
export const days_short: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const day_short_width = 500;
