import { Schedule, ScheduleDay, WiserScheduleCardConfig } from './types';
import { FrontendTranslationData, HomeAssistant, NumberFormat } from 'custom-card-helpers';

import hexRgb from 'hex-rgb';
import { LitElement } from 'lit';
import { days, SEC_PER_HOUR } from './const';

const int = Math.trunc;

export function isDefined<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}


export function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function PrettyPrintName(input: string): string {
  if (typeof input != typeof 'x') input = String(input);
  return capitalize(input.replace(/_/g, ' '));
}

export function PrettyPrintIcon(input?: string): string | void {
  if (!input) return;
  if (typeof input != typeof 'x') input = String(input);
  if (input.match(/^[a-z]+:[a-z0-9-]+$/i)) return input;
  return `hass:${input}`;
}

export function isHex(hex: string): boolean {
  hex = String(hex).replace('#', '')
  return hex.length === 6
    && !isNaN(Number('0x' + hex))
}

export function hexToRgbString(hex: string): string {
  if (isHex(hex)) {
    const rgb = hexRgb(hex)
    return String(rgb.red + ',' + rgb.green + ',' + rgb.blue + ',' + rgb.alpha)
  }
  return '100,100,100'
}

export function getCSSVariable(element: HTMLElement, style_name: string): string {
  return getComputedStyle(element).getPropertyValue(style_name).trim();
}

export function getGreyToYellow(percent: number): string {

    if (percent == 0 ) { return '50,50,50'}
    const r_max = 250;
    const g_max = 200;
    const min = 50;
    const r = int(min + (((r_max - min)/100) * percent));
    const g = int(min + (((g_max - min)/100) * percent));

    return r + ',' + g + ',' + 0;
}

export function color_map(element: LitElement, schedule_type: string, setPoint: string): string {
    if (schedule_type.toLowerCase() === 'onoff') {
        if (setPoint == 'On') { return hexToRgbString(getCSSVariable(element, '--state-on-color')) }
        return hexToRgbString(getCSSVariable(element, '--state-off-color'))
    } else if (['lighting', 'shutters'].includes(schedule_type.toLowerCase())) {
        return getGreyToYellow(parseInt(setPoint)) + ',1'
    } else {
        if (parseFloat(setPoint) == -20) { return "138, 138, 138" }
        const maxc = 25;
        const minc = 5;
        const f = (parseFloat(setPoint) - minc) / (maxc - minc);
        const Y = Math.floor(255 * (1 - f));
        const r = 255;
        const g = Y;
        const b = 0;
        return r + "," + g + "," + b + ',1';
    }
    return "100, 100, 100";
}

export function allow_edit(hass: HomeAssistant, config: WiserScheduleCardConfig): boolean {
    if (config.display_only) return false;
    if ((config.admin_only && hass.user.is_admin) || !config.admin_only) return true;
    return false;
}

export function get_start_time(day: ScheduleDay, index: number): string {
  if (day.slots.length == 0) { return '00:00' }
  return day.slots[index].Time
}

export function get_end_time(day: ScheduleDay, index: number): string {
  if (day.slots.length == 0 || day.slots.length - 1 == index) {return '24:00'}
  return day.slots[index +1].Time
}

export function find_previous_setpoint(day: ScheduleDay, schedule: Schedule): string {
  const day_order = [
    ...days.slice(days.indexOf(day.day) + 1),
    ...days.slice(0, days.indexOf(day.day))
  ].reverse()
  let search_day: string
  for (search_day of day_order) {
    const d = schedule.ScheduleData.filter(rday => rday.day == search_day)[0];
    if (d.slots.length > 0) {
      return d.slots[d.slots.length - 1].Setpoint
    }
  }
  return ''
}

export function get_setpoint(day: ScheduleDay, index: number, schedule: Schedule): string {
  if (index == -1) {
    return find_previous_setpoint(day, schedule)
  }
  return day.slots[index].Setpoint
}

export function stringTimeToSeconds(t: string): number {
    const [hours, mins] = t.split(":")
    return (+hours) * SEC_PER_HOUR + (+mins) * 60
}

export const getLocale = (hass: HomeAssistant): FrontendTranslationData =>
  hass.locale || {
    language: hass.language,
    number_format: NumberFormat.system,
  };

