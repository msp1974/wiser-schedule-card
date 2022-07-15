/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LitElement, html, css, TemplateResult, CSSResultGroup, PropertyValues } from 'lit';
import { property, customElement, state } from 'lit/decorators.js';
import { CurrentUser, fireEvent } from 'custom-card-helpers';
import type {
  WiserScheduleCardConfig,
  Schedule,
  WiserEventData,
  Room,
  Entities,
  ScheduleAssignments,
  SunTimes,
  ScheduleDay,
  ScheduleSlot,
  WiserError,
} from '../types';
import { allow_edit, isDefined } from '../helpers';
import {
  fetchScheduleById,
  fetchRoomsList,
  fetchDeviceList,
  assignSchedule,
  deleteSchedule,
  saveSchedule,
  fetchSunTimes,
  showErrorDialog,
} from '../data/websockets';
import { SubscribeMixin } from '../components/subscribe-mixin';
import { UnsubscribeFunc } from 'home-assistant-js-websocket';

import '../components/schedule-slot-editor';
import '../components/dialog-error';
import { localize } from '../localize/localize';
import { days, SPECIAL_TIMES, SUPPORT_SPECIAL_TIMES } from '../const';

@customElement('wiser-schedule-edit-card')
export class SchedulerEditCard extends SubscribeMixin(LitElement) {
  @property({ attribute: false }) public config!: WiserScheduleCardConfig;
  @property({ attribute: false }) public schedule_id?: number = 0;
  @property({ attribute: false }) public schedule_type?: string;
  @property({ attribute: false }) public use_heat_colors = true;

  @state() schedule?: Schedule;
  @state() rooms: Room[] = [];
  @state() entities: Entities[] = [];
  @state() suntimes?: SunTimes;
  @state() component_loaded?: boolean;
  @state() _activeSlot = null;
  @state() _activeDay = null;
  @state() editMode = false;
  @state() _current_user?: CurrentUser = this.hass?.user;
  @state() _assigning_in_progress = 0;
  @state() _save_in_progress = false;
  @state() error?: WiserError;

  _tempSchedule?: Schedule;
  stepSize = 5;

  async initialise(): Promise<boolean> {
    if (await this._isComponentLoaded()) {
      this.component_loaded = true;
      await this.loadData();
    }
    return true;
  }

  public hassSubscribe(): Promise<UnsubscribeFunc>[] {
    this.initialise();
    return [
      this.hass!.connection.subscribeMessage((ev: WiserEventData) => this.handleUpdate(ev), {
        type: 'wiser_updated',
      }),
    ];
  }

  private async handleUpdate(ev: WiserEventData): Promise<void> {
    if ((!this.config!.hub || ev.hub == this.config!.hub) && ev.event == 'wiser_updated') {
      await this.loadData();
    }
  }

  async _isComponentLoaded(): Promise<boolean> {
    while (!this.hass && !this.config && !this.hass!.config.components.includes('wiser')) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return true;
  }

  getSunTime(day: string, time: string): string {
    if (time == SPECIAL_TIMES[0]) {
      return this.suntimes!.Sunrises[days.indexOf(day)].time;
    }
    return this.suntimes!.Sunsets[days.indexOf(day)].time;
  }

  convertLoadedSchedule(schedule: Schedule): Schedule {
    const updatedScheduleDays = schedule.ScheduleData.map((day) => this.convertLoadedScheduleDay(day));
    schedule.ScheduleData = updatedScheduleDays;
    return schedule;
  }

  convertLoadedScheduleDay(day: ScheduleDay): ScheduleDay {
    const slots = day.slots;
    const outputSlots: ScheduleSlot[] = slots
      .map((slot) => {
        return SPECIAL_TIMES.includes(slot.Time)
          ? { Time: this.getSunTime(day.day, slot.Time), Setpoint: slot.Setpoint, SpecialTime: slot.Time }
          : { Time: slot.Time, Setpoint: slot.Setpoint, SpecialTime: '' };
      })
      .sort((a, b) => (parseInt(a.Time.replace(':', '')) < parseInt(b.Time.replace(':', '')) ? 0 : 1));

    const outputSlotsSet = new Set(outputSlots.map((e) => JSON.stringify(e)));
    const res = Array.from(outputSlotsSet).map((e) => JSON.parse(e));
    const outputDay: ScheduleDay = { day: day.day, slots: res };
    return outputDay;
  }

  convertScheduleForSaving(schedule: Schedule): Schedule {
    const updatedScheduleDays = schedule.ScheduleData.map((day) => this.convertScheduleDayForSaving(day));
    schedule.ScheduleData = updatedScheduleDays;
    return schedule;
  }

  convertScheduleDayForSaving(day: ScheduleDay): ScheduleDay {
    const slots = day.slots;
    const outputSlots: ScheduleSlot[] = slots
      .map((slot) => {
        return SPECIAL_TIMES.includes(slot.SpecialTime)
          ? { Time: slot.SpecialTime, Setpoint: slot.Setpoint, SpecialTime: slot.SpecialTime }
          : { Time: slot.Time, Setpoint: slot.Setpoint, SpecialTime: '' };
      })
      .sort((a, b) => (a.Time.replace(':', '') < b.Time.replace(':', '') ? 0 : 1));
    const outputSlotsSet = new Set(outputSlots.map((e) => JSON.stringify(e)));
    const res = Array.from(outputSlotsSet).map((e) => JSON.parse(e));
    const outputDay: ScheduleDay = { day: day.day, slots: res };
    return outputDay;
  }

  private async loadData() {
    this.error = undefined;
    if (this.schedule_type && this.schedule_id && !this.editMode) {
      await fetchScheduleById(this.hass!, this.config!.hub, this.schedule_type!, this.schedule_id!)
        .then((res) => {
          this.schedule = this.convertLoadedSchedule(res);
        })
        .catch((e) => {
          this.schedule = undefined;
          this.error = e;
        });

      await fetchSunTimes(this.hass!, this.config!.hub)
        .then((res) => {
          this.suntimes = res;
        })
        .catch((e) => {
          this.error = e;
        });

      if (this.schedule) {
        await this.get_entity_list(this.hass!, this.config!.hub)
          .then((res) => {
            this.entities = res;
          })
          .catch((e) => {
            this.error = e;
          });
      }
    }
  }

  private async get_entity_list(hass, hub): Promise<Entities[]> {
    if (this.schedule!.Type.toLowerCase() == 'heating') {
      return await fetchRoomsList(hass, hub);
    }
    return await fetchDeviceList(hass, hub, this.schedule!.SubType);
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('schedule_id') || changedProps.has('editMode')) {
      this.loadData();
      return true;
    }
    if (
      changedProps.has('schedule') ||
      changedProps.has('entities') ||
      changedProps.has('editMode') ||
      changedProps.has('_assigning_in_progress') ||
      changedProps.has('_save_in_progress') ||
      (changedProps.has('error') && isDefined(this.error))
    ) {
      return true;
    }
    return false;
  }

  protected render(): TemplateResult {
    if (!this.hass || !this.config || !this.component_loaded) return html``;
    if (isDefined(this.error)) {
      return html` <ha-card>
        <div class="card-header">
          <div class="name">${this.config!.name}</div>
        </div>
        <div class="card-content">
          <hui-warning> ${this.error.message} </hui-warning>
        </div>
      </ha-card>`;
    }
    if (this.schedule && this.entities && this.suntimes) {
      return html`
        <ha-card>
          <div class="card-header">
            <div class="name">${this.config!.name}</div>
          </div>
          <div class="card-content">
            <div class="schedule-info">
              <span class="sub-heading">${localize('wiser.headings.schedule_type')}: </span> ${this.schedule.SubType}
            </div>
            <div class="schedule-info">
              <span class="sub-heading">${localize('wiser.headings.schedule_id')}: </span> ${this.schedule.Id}
            </div>
            <div class="schedule-info">
              <span class="sub-heading">${localize('wiser.headings.schedule_name')}: </span> ${this.schedule.Name}
            </div>
            <div class=${this.editMode ? 'mode' : ''}>${this.editMode ? 'Edit Mode' : null}</div>
            <div class="wrapper">
              <div class="schedules">
                <div class="slots-wrapper">
                  <wiser-schedule-slot-editor
                    .hass=${this.hass}
                    .config=${this.config}
                    .schedule=${this.editMode ? this._tempSchedule : this.schedule}
                    .schedule_type=${this.schedule_type}
                    .suntimes=${this.suntimes}
                    .editMode=${this.editMode}
                    @scheduleChanged=${this.scheduleChanged}
                  ></wiser-schedule-slot-editor>
                </div>
              </div>
            </div>
            ${this.renderScheduleAssignment(this.entities, this.schedule!.Assignments)}
            ${this.renderScheduleActionButtonSection()}
          </div>
          ${this.renderCardActions()}
        </ha-card>
      `;
    }
    return html` <ha-card>
      <div class="card-header">
        <div class="name">${this.config!.name}</div>
      </div>
      <div class="card-content"></div>
    </ha-card>`;
  }

  renderScheduleAssignment(
    entities: Entities[],
    schedule_entities: ScheduleAssignments[] | string[],
  ): TemplateResult | void {
    if (this.schedule && !this.editMode) {
      if (allow_edit(this.hass!, this.config)) {
        return html`
          <div class="assignment-wrapper">
            <div class="sub-heading">${localize('wiser.headings.schedule_assignment')}</div>
            ${entities.length > 0
              ? entities.map((entity) =>
                  this.renderEntityButton(
                    entity,
                    schedule_entities
                      .map(function (a) {
                        return a.name;
                      })
                      .includes(entity.Name),
                  ),
                )
              : html`<div class="schedule-info">(No Assignable Devices)</div>`}
          </div>
        `;
      } else {
        return html`
          <div class="assignment-wrapper">
            <div class="sub-heading">${localize('wiser.headings.schedule_assignment')}</div>
            ${schedule_entities.length > 0
              ? entities
                  .filter((entity) =>
                    schedule_entities
                      .map(function (a) {
                        return a.name;
                      })
                      .includes(entity.Name),
                  )
                  .map((entity) => this.renderEntityLabel(entity))
              : html`<span class="assignment-label">${localize('wiser.headings.not_assigned')}</span>`}
          </div>
        `;
      }
    }
  }

  renderEntityButton(entity: Entities, active: boolean): TemplateResult | void {
    return html`
      <mwc-button id=${entity.Id} class=${active ? 'active' : ''} @click=${this.entityAssignmentClick}>
        ${this._assigning_in_progress == entity.Id
          ? html`<span class="waiting"><ha-circular-progress active size="small"></ha-circular-progress></span>`
          : null}
        ${entity.Name}
      </mwc-button>
    `;
  }

  renderScheduleActionButtonSection(): TemplateResult | void {
    //${this.renderFilesScheduleButton()}
    if (this.schedule && !this.editMode) {
      if (allow_edit(this.hass!, this.config)) {
        return html`
          <div class="actions-wrapper">
            <div class="sub-heading">${localize('wiser.headings.schedule_actions')}</div>
            <div class="wrapper schedule-action-wrapper">
              ${this.renderScheduleRenameButton()} ${this.renderEditScheduleButton()} ${this.renderCopyScheduleButton()}
              ${this.renderDeleteScheduleButton()}
            </div>
          </div>
        `;
      }
    }
  }

  renderEntityLabel(entity: Entities): TemplateResult | void {
    return html` <span class="assignment-label"> ${entity.Name} </span> `;
  }

  renderCardActions(): TemplateResult | void {
    if (!this.config.selected_schedule || this.editMode) {
      return html`
        <div class="card-actions">
          <div class="action-buttons">
            ${!this.editMode ? this.renderBackButton() : null} ${this.editMode ? this.renderCancelButton() : null}
            ${this.editMode ? this.renderSaveScheduleButton() : null}
          </div>
        </div>
      `;
    }
  }

  renderBackButton(): TemplateResult | void {
    return html` <mwc-button @click=${this.backClick}>Back </mwc-button> `;
  }

  renderCancelButton(): TemplateResult | void {
    return html` <mwc-button @click=${this.cancelClick}>Cancel </mwc-button> `;
  }

  renderScheduleRenameButton(): TemplateResult {
    return html`
      <mwc-button class="large active" label=${localize('wiser.actions.rename')} @click=${this.renameScheduleClick}>
      </mwc-button>
    `;
  }

  renderDeleteScheduleButton(): TemplateResult | void {
    return html`
      <mwc-button
        class="large warning"
        label=${this.hass!.localize('ui.common.delete')}
        .disabled=${this.schedule_id == 1000}
        @click=${this.deleteClick}
      >
      </mwc-button>
    `;
  }

  renderCopyScheduleButton(): TemplateResult | void {
    return html`
      <mwc-button
        class="large active"
        label=${localize('wiser.actions.copy')}
        .disabled=${this.schedule_id == 1000}
        @click=${this.copyClick}
      >
      </mwc-button>
    `;
  }

  renderEditScheduleButton(): TemplateResult | void {
    return html`
      <mwc-button class="large active" label=${this.hass!.localize('ui.common.edit')} @click=${this.editClick}>
      </mwc-button>
    `;
  }

  renderFilesScheduleButton(): TemplateResult | void {
    return html`
      <mwc-button class="large active" label=${localize('wiser.actions.files')} @click=${this.filesClick}> </mwc-button>
    `;
  }

  renderSaveScheduleButton(): TemplateResult | void {
    if (allow_edit(this.hass!, this.config)) {
      return html`
        <mwc-button class="right" @click=${this.saveClick}>
          ${this._save_in_progress ? html`<ha-circular-progress active size="small"></ha-circular-progress>` : 'Save'}
        </mwc-button>
      `;
    }
  }

  async entityAssignmentClick(ev: Event): Promise<void> {
    const e = ev.target as HTMLDivElement;
    this._assigning_in_progress = parseInt(e.id);
    if (allow_edit(this.hass!, this.config)) {
      await assignSchedule(
        this.hass!,
        this.config!.hub,
        this.schedule_type!,
        this.schedule_id!,
        e.id,
        e.classList.contains('active'),
      );
    }
    this._assigning_in_progress = 0;
  }

  backClick(): void {
    const myEvent = new CustomEvent('backClick');
    this.dispatchEvent(myEvent);
  }

  editClick(): void {
    this._tempSchedule = this.schedule;
    this.editMode = !this.editMode;
  }

  copyClick(): void {
    const myEvent = new CustomEvent('copyClick');
    this.dispatchEvent(myEvent);
  }

  filesClick(): void {
    const myEvent = new CustomEvent('filesClick');
    this.dispatchEvent(myEvent);
  }

  async renameScheduleClick(): Promise<void> {
    const myEvent = new CustomEvent('renameClick');
    this.dispatchEvent(myEvent);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async deleteClick(ev): Promise<void> {
    const element = ev.target as HTMLElement;
    const result = await new Promise((resolve) => {
      fireEvent(element, 'show-dialog', {
        dialogTag: 'wiser-dialog-delete-confirm',
        dialogImport: () => import('../components/dialog-delete-confirm'),
        dialogParams: {
          cancel: () => {
            resolve(false);
          },
          confirm: () => {
            resolve(true);
          },
          name: this.schedule!.Name,
        },
      });
    });
    if (result) {
      this.schedule_id = 0;
      await deleteSchedule(this.hass!, this.config!.hub, this.schedule!.Type, this.schedule!.Id);
      const myEvent = new CustomEvent('scheduleDeleted');
      this.dispatchEvent(myEvent);
    }
  }

  cancelClick(): void {
    this.editMode = false;
  }

  validateSchedule(schedule: Schedule): boolean {
    const hasSlotsForDay = schedule.ScheduleData.map((day) => {
      return day.slots;
    });
    const hasSlots = hasSlotsForDay.map((day) => {
      return day.length > 0;
    });
    return hasSlots.includes(true);
  }

  async saveClick(): Promise<void> {
    this._save_in_progress = true;
    if (this.validateSchedule(this._tempSchedule!)) {
      if (SUPPORT_SPECIAL_TIMES.includes(this.schedule_type!)) {
        this._tempSchedule = await this.convertScheduleForSaving(this._tempSchedule!);
      }
      await saveSchedule(this.hass!, this.config.hub, this.schedule_type!, this.schedule_id!, this._tempSchedule!);
      this.editMode = false;
    } else {
      const errorMessage = html`The schedule you are trying to save has no time slots.`;
      showErrorDialog(this, 'Error Saving Schedule', errorMessage);
    }
    this._save_in_progress = false;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  scheduleChanged(ev): void {
    this._tempSchedule = ev.detail.schedule;
    this.render();
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
        max-width: 100%;
      }
      div.outer {
        width: 100%;
        overflow-x: hidden;
        overflow-y: hidden;
        border-radius: 5px;
      }
      div.wrapper,
      div.time-wrapper {
        white-space: nowrap;
        transition: width 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67), margin 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67);
      }
      div.assignment-wrapper,
      div.actions-wrapper {
        border-top: 1px solid var(--divider-color, #e8e8e8);
        padding: 5px 0px;
        min-height: 40px;
      }
      div.mode {
        position: absolute;
        right: 10px;
        top: 64px;
        background: var(--primary-color);
        padding: 2px 10px;
        border-radius: 20px;
        font-size: smaller;
        color: var(--app-header-text-color);
      }
      div.action-buttons {
        display: flow-root;
      }
      span.assignment-label {
        color: var(--primary-color);
        text-transform: uppercase;
        font-weight: 500;
        font-size: var(--material-small-font-size);
        padding: 5px 10px;
      }
      .slot {
        float: left;
        background: rgba(var(--rgb-primary-color), 0.7);
        height: 60px;
        cursor: pointer;
        box-sizing: border-box;
        transition: background 0.1s cubic-bezier(0.17, 0.67, 0.83, 0.67);
        position: relative;
        height: 40px;
        line-height: 40px;
        font-size: 10px;
        text-align: center;
        overflow: hidden;
      }
      .slot.previous {
        cursor: default;
      }
      .slot.selected {
        background: rgba(52, 143, 255, 1);
      }
      .setpoint {
        z-index: 3;
        position: relative;
        text-align: center;
      }
      .slotoverlay {
        position: absolute;
        display: hidden;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        /*background-color: rgba(0,0,0,0.5);*/
        z-index: 2;
        cursor: pointer;
      }
      .previous {
        display: block;
        background: repeating-linear-gradient(
          135deg,
          rgba(0, 0, 0, 0),
          rgba(0, 0, 0, 0) 5px,
          rgba(255, 255, 255, 0.2) 5px,
          rgba(255, 255, 255, 0.2) 10px
        );
      }
      .wrapper.selectable .slot:hover {
        background: rgba(var(--rgb-primary-color), 0.85);
      }
      .slot:not(:first-child) {
        border-left: 1px solid var(--card-background-color);
      }
      .slot:not(:last-child) {
        border-right: 1px solid var(--card-background-color);
      }
      .slot.active {
        background: rgba(var(--rgb-accent-color), 0.7);
      }
      .slot.noborder {
        border: none;
      }
      .wrapper.selectable .slot.active:hover {
        background: rgba(var(--rgb-accent-color), 0.85);
      }
      .wrapper .days .day {
        line-height: 42px;
        float: left;
        width: 100%;
      }
      .wrapper .schedules {
        position: relative;
        padding-top: 30px;
        width: 100%;
      }
      .wrapper .schedules .slots {
        height: 40px;
        border-radius: 5px;
        overflow: auto;
        margin-bottom: 2px;
        display: flex;
      }

      .setpoint.rotate {
        z-index: 3;
        transform: rotate(-90deg);
        position: absolute;
        top: 20px;
        height: 0px !important;
        width: 100%;
        overflow: visible !important;
      }
      div.schedule-action-wrapper {
        display: flex;
        justify-content: center;
      }
      div.time-wrapper div {
        float: left;
        display: flex;
        position: relative;
        height: 25px;
        line-height: 25px;
        font-size: 12px;
        text-align: center;
        align-content: center;
        align-items: center;
        justify-content: center;
      }
      div.time-wrapper div.time:before {
        content: ' ';
        background: var(--disabled-text-color);
        position: absolute;
        left: 0px;
        top: 0px;
        width: 1px;
        height: 5px;
        margin-left: 50%;
        margin-top: 0px;
      }
      .slot span {
        font-size: 10px;
        color: var(--text-primary-color);
        height: 100%;
        display: flex;
        align-content: center;
        align-items: center;
        justify-content: center;
        transition: margin 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67);
        word-break: nowrap;
        white-space: normal;
        overflow: hidden;
        line-height: 1em;
      }
      div.handle {
        display: flex;
        height: 100%;
        width: 36px;
        margin-left: -19px;
        margin-bottom: -60px;
        align-content: center;
        align-items: center;
        justify-content: center;
      }
      div.button-holder {
        background: var(--card-background-color);
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        visibility: hidden;
        animation: 0.2s fadeIn;
        animation-fill-mode: forwards;
      }
      mwc-button.warning {
        --mdc-theme-primary: #fff;
        background-color: var(--error-color);
        border-radius: var(--mdc-shape-small, 4px);
      }
      mwc-button.large {
        width: 22.5%;
        margin: 2px;
        max-width: 200px;
      }
      mwc-button.right {
        float: right;
      }
      mwc-button.warning .mdc-button .mdc-button__label {
        color: var(--primary-text-color);
      }
      ha-icon-button {
        --mdc-icon-button-size: 36px;
        margin-top: -6px;
        margin-left: -6px;
      }
      @keyframes fadeIn {
        99% {
          visibility: hidden;
        }
        100% {
          visibility: visible;
        }
      }

      mwc-button ha-icon {
        margin-right: 11px;
      }
      mwc-button.active {
        background: var(--primary-color);
        --mdc-theme-primary: var(--text-primary-color);
        border-radius: 4px;
      }
      mwc-button {
        margin: 2px 0;
      }
      .card-header ha-icon-button {
        position: absolute;
        right: 6px;
        top: 6px;
      }
      .sub-heading {
        padding-bottom: 10px;
        font-weight: 500;
      }
      span.waiting {
        position: absolute;
        height: 28px;
        width: 100%;
        margin: 4px;
      }
      div.schedule-info {
        margin: 3px 0;
      }
    `;
  }
}
