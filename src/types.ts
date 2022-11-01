import { LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';

declare global {
  interface HTMLElementTagNameMap {
    'wiser-schedule-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

// TODO Add your configuration elements here for type-checking
export interface WiserScheduleCardConfig extends LovelaceCardConfig {
  name?: string;
  theme_colors: boolean;
  show_badges: boolean;
  show_schedule_id: boolean;
  display_only: boolean;
  admin_only: boolean;
  view_type: string;
  hub: string;
  selected_schedule?: string;
}

interface SunTime {
  day: string;
  time: string;
}

export interface SunTimes {
  Sunrises: SunTime[];
  Sunsets: SunTime[];
}

export interface ScheduleSlot {
  Time: string;
  Setpoint: string;
  SpecialTime: string;
}

export interface ScheduleDay {
  day: string;
  slots: ScheduleSlot[];
}

export interface Schedule {
  Id: number;
  Name: string;
  Type: string;
  SubType: string;
  Assignments: ScheduleAssignments[];
  ScheduleData: ScheduleDay[];
}

export interface ScheduleAssignments {
  Id: number;
  Name: string;
}

export interface ScheduleListItem {
  Id: number;
  Type: string;
  Name: string;
  Assignments: number;
}

export interface Room {
  Id: number;
  Name: string;
}

export interface Entities {
  Id: number;
  Name: string;
}

export interface NewSchedule {
  Name: string;
  Type: string;
}

enum WiserEvent {
  WiserUpdated = 'wiser_updated',
}

export interface WiserEventData {
  hub: string;
  event: WiserEvent;
}

export interface WiserError {
  code: string;
  message: string;
}
