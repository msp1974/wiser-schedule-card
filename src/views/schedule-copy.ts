/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LitElement, html, css, TemplateResult, CSSResultGroup } from 'lit';
import { property, customElement, state } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';
import type { WiserScheduleCardConfig, ScheduleListItem, Schedule } from '../types';
import { copySchedule, fetchScheduleById, fetchSchedules } from '../data/websockets';
import { EViews } from '../const';

import '../components/dialog-delete-confirm';
import { localize } from '../localize/localize';

@customElement('wiser-schedule-copy-card')
export class ScheduleCopyCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public config?: WiserScheduleCardConfig;
  @property({ attribute: false }) public schedule_id?: number = 0;
  @property({ attribute: false }) public schedule_type?: string;

  @state() schedule?: Schedule;
  @state() component_loaded = false;
  @state() _copy_in_progress = 0;
  @state() private _schedule_list: ScheduleListItem[] = [];

  constructor() {
    super();
    this.initialise();
  }

  async initialise(): Promise<boolean> {
    if (await this.isComponentLoaded()) {
      this.component_loaded = true;
      await this.loadData();
    }
    return true;
  }

  async isComponentLoaded(): Promise<boolean> {
    while (!this.hass || !this.hass.config.components.includes('wiser')) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return true;
  }

  private async loadData() {
    this.schedule = await fetchScheduleById(this.hass!, this.config!.hub, this.schedule_type!, this.schedule_id!);
    this._schedule_list = await fetchSchedules(this.hass!, this.config!.hub, this.schedule_type);
  }

  render(): TemplateResult {
    if (!this.hass || !this.config || !this.schedule) return html``;
    return html`
      <ha-card>
        <div class="card-header">
          <div class="name">${this.config!.name}</div>
        </div>
        <div class="card-content">
          <div>${localize('wiser.headings.copy_schedule')}</div>
          <div class="schedule-info">
            <span class="sub-heading">${localize('wiser.headings.schedule_type')}:</span> ${this.schedule.Type}
          </div>
          <div class="schedule-info">
            <span class="sub-heading">${localize('wiser.headings.schedule_id')}:</span> ${this.schedule.Id}
          </div>
          <div class="schedule-info">
            <span class="sub-heading">${localize('wiser.headings.schedule_name')}:</span> ${this.schedule.Name}
          </div>
          <div class="wrapper" style="margin: 20px 0 0 0;">${localize('wiser.helpers.select_copy_schedule')}</div>
          <div class="assignment-wrapper">
            ${this._schedule_list
              .filter((schedule) => schedule.Id != this.schedule?.Id)
              .map((schedule) => this.renderScheduleButtons(schedule))}
          </div>
        </div>
        <div class="card-actions">
          <mwc-button @click=${this.cancelClick}> ${this.hass.localize('ui.common.cancel')} </mwc-button>
        </div>
      </ha-card>
    `;
  }

  renderScheduleButtons(schedule: ScheduleListItem): TemplateResult {
    return html`
      <mwc-button id=${schedule.Id} @click=${this._copySchedule} .value=${schedule.Name}>
        ${this._copy_in_progress == schedule.Id
          ? html`<span class="waiting"><ha-circular-progress active size="small"></ha-circular-progress></span>`
          : null}
        ${schedule.Name}
      </mwc-button>
    `;
  }

  cancelClick(): void {
    const myEvent = new CustomEvent('backClick', { detail: EViews.ScheduleEdit });
    this.dispatchEvent(myEvent);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async _copySchedule(ev): Promise<void> {
    const target = ev.target;
    if (target.id) {
      this._copy_in_progress = parseInt(target.id);
      await copySchedule(this.hass!, this.config!.hub, this.schedule_type!, this.schedule_id!, parseInt(target.id));
      this._copy_in_progress = 0;
      const myEvent = new CustomEvent('scheduleCopied');
      this.dispatchEvent(myEvent);
    }
  }

  static get styles(): CSSResultGroup {
    return css`
      div.wrapper {
        white-space: nowrap;
        transition: width 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67), margin 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67);
        overflow: auto;
      }
      div.wrapper {
        color: var(--primary-text-color);
        padding: 5px 0;
      }
      .schedule-type-select {
        margin: 20px 0 0 0;
      }
      .schedule-name {
        margin: 20px 0 0 0;
        width: 100%;
      }
      ha-icon-button {
        --mdc-icon-button-size: 36px;
        margin-top: -6px;
        margin-left: -6px;
      }
      .card-header ha-icon-button {
        position: absolute;
        right: 6px;
        top: 6px;
      }
      mwc-button.active {
        background: var(--primary-color);
        --mdc-theme-primary: var(--text-primary-color);
        border-radius: 4px;
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
