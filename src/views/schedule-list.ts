/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LitElement, html, css, PropertyValues, TemplateResult } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { hasConfigOrEntityChanged } from 'custom-card-helpers';
import { UnsubscribeFunc } from 'home-assistant-js-websocket';

import type { WiserScheduleCardConfig, ScheduleListItem, WiserEventData, WiserError } from '../types';
import { commonStyle } from '../styles';
import { fetchSchedules, fetchScheduleTypes } from '../data/websockets';
import { allow_edit, PrettyPrintIcon } from '../helpers';
import { ScheduleIcons } from '../const';
import { SubscribeMixin } from '../components/subscribe-mixin';

@customElement('wiser-schedule-list-card')
export class ScheduleListCard extends SubscribeMixin(LitElement) {
  @property({ attribute: false }) public config?: WiserScheduleCardConfig;
  @property({ attribute: false }) public schedule_list?: ScheduleListItem[];
  @property({ attribute: false }) public component_loaded = false;

  supported_schedule_types?: string[];
  connectionError = false;
  error?: WiserError;

  async initialise(): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  private async loadData() {
    this.error = undefined;
    await fetchScheduleTypes(this.hass!, this.config!.hub)
      .then((res) => {
        this.supported_schedule_types = res;
      })
      .catch((e) => {
        this.error = e;
      });
    if (this.supported_schedule_types) {
      await fetchSchedules(this.hass!, this.config!.hub)
        .then((res) => {
          this.schedule_list = res;
        })
        .catch((e) => {
          this.error = e;
        });
    }
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('schedule_list')) {
      return true;
    }
    if (hasConfigOrEntityChanged(this, changedProps, false)) {
      this.loadData();
      return true;
    }
    return false;
  }

  render(): TemplateResult {
    if (!this.hass || !this.config) return html``;
    if (this.schedule_list && this.schedule_list.length > 0) {
      return html`
        <ha-card>
          <div class="card-header">
            <div class="name">${this.config.name}</div>
          </div>
          <div class="card-content">
            <div class="info-text">Select a schedule to view</div>
            ${this.supported_schedule_types!.map((schedule_type) => this.renderScheduleItemsByType(schedule_type))}
          </div>
          ${this.renderAddScheduleButton()}
        </ha-card>
      `;
    } else {
      return html`
        <ha-card>
          <div class="card-header">
            <div class="name">${this.config.name}</div>
          </div>
          <div class="card-content">${this._showWarning('No schedules found')}</div>
        </ha-card>
      `;
    }
  }

  private _showWarning(warning: string): TemplateResult {
    return html` <hui-warning>${warning}</hui-warning> `;
  }

  renderScheduleItemsByType(schedule_type: string): TemplateResult {
    const filtered_schedule_list = this.schedule_list!.filter((t) => t.Type === schedule_type);
    if (filtered_schedule_list.length > 0) {
      return html`
        <div class="sub-heading">
          <fieldset>
            <legend>${schedule_type}</legend>
            <div class="wrapper">${filtered_schedule_list.map((schedule) => this.renderScheduleItem(schedule))}</div>
          </fieldset>
        </div>
      `;
    }
    return html``;
  }

  renderScheduleItem(schedule: ScheduleListItem): TemplateResult | void {
    const icon = ScheduleIcons[schedule.Type];
    return html`
      <div
        class="schedule-item"
        id=${'schedule' + schedule.Id}
        @click=${() => this._scheduleClick(schedule.Type, schedule.Id)}
      >
        <ha-icon .icon="${PrettyPrintIcon(icon)}"></ha-icon>
        <span class="button-label">${schedule.Name}</span>
        ${this.config?.show_badges ? html`<span class="badge">${schedule.Assignments}</span>` : null}
      </div>
    `;
  }

  renderAddScheduleButton(): TemplateResult | void {
    if (allow_edit(this.hass!, this.config!)) {
      return html`
        <div class="card-actions">
          <mwc-button @click=${this._addScheduleClick}>Add Schedule </mwc-button>
        </div>
      `;
    }
  }

  async _addScheduleClick(): Promise<void> {
    const myEvent = new CustomEvent('addScheduleClick');
    this.dispatchEvent(myEvent);
  }

  _scheduleClick(schedule_type: string, schedule_id: number): void {
    const myEvent = new CustomEvent('scheduleClick', {
      detail: { schedule_type: schedule_type, schedule_id: schedule_id },
    });
    this.dispatchEvent(myEvent);
  }

  static styles = css`
    ${commonStyle}
    div.info-text {
      margin-bottom: 10px;
    }
    span.button-label {
      padding-left: 5px;
      text-transform: uppercase;
      font-weight: 500;
    }
    div.wrapper {
      white-space: nowrap;
      transition: width 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67), margin 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67);
      overflow: auto;
      display: flex;
      flex-wrap: wrap;
      flex-direction: row;
      justify-content: flex-start;
    }
    div.sub-heading {
      display: block;
      margin: 5px 0;
    }
    div.sub-heading fieldset {
      border: 1px solid var(--divider-color, #e8e8e8);
      border-radius: 5px;
      font-size: small;
    }
    div.schedule-item ha-icon {
      float: left;
      cursor: pointer;
    }
    .schedule-item {
      line-height: 32px;
      cursor: pointer;
      white-space: nowrap;
      text-overflow: ellipsis;
      margin: 5px 10px 5px 0px;
      display: flex;
      padding: 2px 10px 2px 5px;
      color: var(--mdc-theme-primary, #6200ee);
      background: var(--primary-color);
      --mdc-theme-primary: var(--text-primary-color);
      border-radius: 4px;
      font-size: var(--material-button-font-size);
      position: relative;
    }
    .badge {
      font-size: small;
      position: absolute;
      top: -5px;
      right: -8px;
      background-color: var(--label-badge-red);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      line-height: 20px;
      text-align: center;
    }
  `;
}
