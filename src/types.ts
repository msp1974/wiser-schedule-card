import { LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';

declare global {
  interface HTMLElementTagNameMap {
    'wiser-schedule-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

// TODO Add your configuration elements here for type-checking
export interface WiserScheduleCardConfig extends LovelaceCardConfig {
    type: string;
    name?: string;
    theme_colors: boolean;
    show_badges: boolean;
    display_only: boolean;
    admin_only: boolean,
    hub: string;
    selected_schedule?: string;
}

export interface ScheduleSlot {
  Time: string;
  Setpoint: string;
}

export interface ScheduleDay {
  day: string;
  slots: ScheduleSlot[]
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

export enum ETimeEvent {
  Sunrise = 'sunrise',
  Sunset = 'sunset',
}

enum WiserEvent {
  WiserUpdated = 'wiser_updated'
}

export interface WiserEventData {
  event: WiserEvent;
}
