/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators';
import {
  HomeAssistant,
  LovelaceCardEditor,
  getLovelace,
  hasConfigOrEntityChanged,
} from 'custom-card-helpers'; // This is a community maintained npm module with common helper functions/types. https://github.com/custom-cards/custom-card-helpers

import type { WiserScheduleCardConfig } from './types';
import { CARD_VERSION, EViews } from './const';
import { localize } from './localize/localize';
import { HassEvent } from 'home-assistant-js-websocket';

import './views/schedule-list';
import './views/schedule-edit';
import './views/schedule-add';
import './views/schedule-copy';
import './views/schedule-rename';
import './editor';



/* eslint no-console: 0 */
console.info(
  `%c  WISER-SCHEDULE-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: orange; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// This puts your card into the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'wiser-schedule-card',
  name: 'Wiser Schedule Card',
  description: 'A card to manage Wiser schedules',
});


@customElement('wiser-schedule-card')
export class WiserScheduleCard extends LitElement {

    @property({ attribute: false }) private _hass?: HomeAssistant;
    @state() private config?: WiserScheduleCardConfig;
    @state() private _view: EViews = EViews.Overview;
    @state() private translationsLoaded = true;
    @state() private component_loaded?: boolean = false;
    @state() private _schedule_id?: number = 0;
    @state() private _schedule_type?: string = 'heating';

    constructor() {
        super();
        this.initialise();
    }

    public static async getConfigElement(): Promise<LovelaceCardEditor> {
        return document.createElement('wiser-schedule-card-editor');
    }

    public static getStubConfig(): Record<string, unknown> {
        return {};
    }

    public setConfig(config: WiserScheduleCardConfig): void {
        if (!config) {
            throw new Error(localize('common.invalid_configuration'));
        }

        if (config.test_gui) {
            getLovelace().setEditMode(true);
        }

        this.config = {
        name: 'Wiser Schedule',
        ...config,
        };
    }

    set hass(hass: HomeAssistant) {
        this._hass = hass;
    }

    async initialise(): Promise<boolean> {
        if (await this.isComponentLoaded()) {
            this.component_loaded = true;
        }
        this.processConfigSchedule();
        return true;
    }

    async isComponentLoaded(): Promise<boolean> {
        while (!this._hass || !this._hass.config.components.includes("wiser")) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
    }

    processConfigSchedule(): void {
        if (this.config!.selected_schedule) {
            this._schedule_type = this.config!.selected_schedule.split('|')[0];
            this._schedule_id = parseInt(this.config!.selected_schedule.split('|')[1]);
            this._view = EViews.ScheduleEdit;
        } else {
            this._schedule_type = '';
            this._schedule_id = 0;
            this._view = EViews.Overview;
        }
    }

    public getCardSize(): number {
        return 9;
    }

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        if (!this.config || !this.component_loaded) {
            return false;
        }

        if (changedProps.has('config')) {
            this.processConfigSchedule();
        }

        if (changedProps.has("component_loaded")) { return true }
        if (changedProps.has("_view")) { return true }
        if (changedProps.has("_schedule_list")) { return true }

        return hasConfigOrEntityChanged(this, changedProps, false);
    }

    async _handleEvent(ev: HassEvent): Promise<void> {
        if (ev.event_type === 'wiser_update_received') {
            const myEvent = new CustomEvent('wiser-update', {});
            this.dispatchEvent(myEvent);
        }
    }


    protected render(): TemplateResult | void {
        if (!this._hass || !this.config || !this.translationsLoaded) return html``;
        if (this._view == EViews.Overview) {
        return html`
            <wiser-schedule-list-card id="schedule_list"
                .hass=${this._hass}
                .config=${this.config}
                @scheduleClick=${this._scheduleClick}
                @addScheduleClick=${this._addScheduleClick}
            ></wiser-schedule-list-card>
        `;
        } else if (this._view == EViews.ScheduleEdit && this._schedule_id) {
        return html`
            <wiser-schedule-edit-card
                .hass=${this._hass}
                .config=${this.config}
                .schedule_id=${this._schedule_id}
                .schedule_type=${this._schedule_type}
                @backClick=${this._backClick}
                @renameClick=${this._renameClick}
                @editClick=${this._editClick}
                @copyClick=${this._copyClick}
                @scheduleDeleted=${this._scheduleDeleted}
            ></wiser-schedule-edit-card>
        `;
        } else if (this._view == EViews.ScheduleAdd) {
        return html`
            <wiser-schedule-add-card
                .hass=${this._hass}
                .config=${this.config}
                @backClick=${this._backClick}
                @scheduleAdded=${this._scheduleAdded}
            ></wiser-schedule-add-card>
        `;
        } else if (this._view == EViews.ScheduleCopy) {
        return html`
            <wiser-schedule-copy-card
                .hass=${this._hass}
                .config=${this.config}
                .schedule_id=${this._schedule_id}
                .schedule_type=${this._schedule_type}
                @backClick=${this._backClick}
                @scheduleCopied=${this._scheduleCopied}
            ></wiser-schedule-copy-card>
        `;
        } else if (this._view == EViews.ScheduleRename) {
            return html`
                <wiser-schedule-rename-card
                    .hass=${this._hass}
                    .config=${this.config}
                    .schedule_id=${this._schedule_id}
                    .schedule_type=${this._schedule_type}
                    @backClick=${this._backClick}
                    @scheduleRenamed=${this._scheduleRenamed}
                ></wiser-schedule-rename-card>
            `;
        }
        return html``;
    }

    private _scheduleClick(ev: CustomEvent): void {
        this._schedule_type = ev.detail.schedule_type;
        this._schedule_id = ev.detail.schedule_id;
        this._view = EViews.ScheduleEdit;
    }

    private _addScheduleClick() {
        this._view = EViews.ScheduleAdd;
    }

    private _renameClick() {
        this._view = EViews.ScheduleRename
    }

    private _editClick() {
        this._view = EViews.ScheduleEdit
    }

    private _copyClick() {
        this._view = EViews.ScheduleCopy
    }

    private _backClick(ev: { detail: EViews; }) {
        if (ev.detail) {
            this._view = ev.detail;
        } else {
            this._view = EViews.Overview;
        }
    }

    private _scheduleDeleted() {
        this._view = EViews.Overview;
    }

    private _scheduleAdded() {
        this._view = EViews.Overview;
    }

    private _scheduleCopied() {
        this._view = EViews.ScheduleEdit;
    }

    private _scheduleRenamed() {
        this._view = EViews.ScheduleEdit;
    }

}
