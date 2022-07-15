import { fireEvent, HomeAssistant } from 'custom-card-helpers';
import { TemplateResult } from 'lit';
import { Schedule, Entities, ScheduleListItem, SunTimes } from '../types';

export const fetchHubs = (hass: HomeAssistant): Promise<string[]> =>
  hass.callWS({
    type: 'wiser/hubs',
  });

export const fetchSunTimes = (hass: HomeAssistant, hub: string): Promise<SunTimes> =>
  hass.callWS({
    type: 'wiser/suntimes',
    hub: hub,
  });

export const fetchScheduleTypes = (hass: HomeAssistant, hub: string): Promise<string[]> =>
  hass.callWS({
    type: 'wiser/schedules/types',
    hub: hub,
  });

export const fetchSchedules = (hass: HomeAssistant, hub: string, schedule_type = ''): Promise<ScheduleListItem[]> =>
  hass.callWS({
    type: 'wiser/schedules',
    hub: hub,
    schedule_type: schedule_type,
  });

export const fetchScheduleById = (
  hass: HomeAssistant,
  hub: string,
  schedule_type: string,
  id: number,
): Promise<Schedule> =>
  hass.callWS({
    type: 'wiser/schedule/id',
    hub: hub,
    schedule_type: schedule_type,
    schedule_id: id,
  });

export const fetchRoomsList = (hass: HomeAssistant, hub: string): Promise<Entities[]> =>
  hass.callWS({
    type: 'wiser/rooms',
    hub: hub,
  });

export const fetchDeviceList = (hass: HomeAssistant, hub: string, device_type: string): Promise<Entities[]> =>
  hass.callWS({
    type: 'wiser/devices',
    device_type: device_type,
    hub: hub,
  });

export const assignSchedule = (
  hass: HomeAssistant,
  hub: string,
  schedule_type: string,
  schedule_id: number,
  id: string,
  remove = false,
): Promise<boolean> =>
  hass.callWS({
    type: 'wiser/schedule/assign',
    hub: hub,
    schedule_type: schedule_type,
    schedule_id: schedule_id,
    entity_id: id,
    remove: remove,
  });

export const createSchedule = (
  hass: HomeAssistant,
  hub: string,
  schedule_type: string,
  name: string,
): Promise<boolean> =>
  hass.callWS({
    type: 'wiser/schedule/create',
    hub: hub,
    schedule_type: schedule_type,
    name: name,
  });

export const deleteSchedule = (
  hass: HomeAssistant,
  hub: string,
  schedule_type: string,
  schedule_id: number,
): Promise<boolean> =>
  hass.callWS({
    type: 'wiser/schedule/delete',
    hub: hub,
    schedule_type: schedule_type,
    schedule_id: schedule_id,
  });

export const saveSchedule = (
  hass: HomeAssistant,
  hub: string,
  schedule_type: string,
  schedule_id: number,
  schedule: Schedule,
): Promise<boolean> =>
  hass.callWS({
    type: 'wiser/schedule/save',
    hub: hub,
    schedule_type: schedule_type,
    schedule_id: schedule_id,
    schedule: schedule,
  });

export const copySchedule = (
  hass: HomeAssistant,
  hub: string,
  schedule_type: string,
  from_schedule_id: number,
  to_schedule_id: number,
): Promise<boolean> =>
  hass.callWS({
    type: 'wiser/schedule/copy',
    hub: hub,
    schedule_type: schedule_type,
    schedule_id: from_schedule_id,
    to_schedule_id: to_schedule_id,
  });

export const renameSchedule = (
  hass: HomeAssistant,
  hub: string,
  schedule_type: string,
  schedule_id: number,
  schedule_name: string,
): Promise<boolean> =>
  hass.callWS({
    type: 'wiser/schedule/rename',
    hub: hub,
    schedule_type: schedule_type,
    schedule_id: schedule_id,
    schedule_name: schedule_name,
  });

export function showErrorDialog(target: HTMLElement, title: string, error: string | TemplateResult): void {
  fireEvent(target, 'show-dialog', {
    dialogTag: 'wiser-dialog-error',
    dialogImport: () => import('../components/dialog-error'),
    dialogParams: { title: title, error: error },
  });
}
