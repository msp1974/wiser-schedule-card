/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LitElement, html, css, TemplateResult, CSSResultGroup } from 'lit';
import { property, customElement, state } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';
import type { WiserScheduleCardConfig, Schedule } from '../types';
import { fetchScheduleById, renameSchedule } from '../data/websockets';
import '../components/dialog-delete-confirm';
import { EViews } from '../const';

@customElement('wiser-schedule-rename-card')
export class ScheduleRenameCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public config?: WiserScheduleCardConfig;
  @property({ attribute: false }) public component_loaded = false;
  @property({ attribute: false }) public schedule_type?: string;
  @property({ attribute: false }) public schedule_id?: number;

  @state() private _newScheduleName = '';
  @state() private _schedule?: Schedule;
  @state() private _rename_in_progress = false;

  constructor() {
    super();
    this.initialise();
  }

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

  private async loadData() {
    this._schedule = await fetchScheduleById(this.hass!, this.config!.hub, this.schedule_type!, this.schedule_id!);
  }

  render(): TemplateResult {
    if (!this.hass || !this.config) return html``;
    return html`
      <ha-card>
        <div class="card-header">
          <div class="name">${this.config!.name}</div>
        </div>
        <div class="card-content">
          <div>Rename Schedule</div>
          <div class="wrapper">${'Enter the new schedule name'}</div>
          <ha-textfield
            class="schedule-name"
            auto-validate
            required
            label="Schedule Name"
            value=${this._schedule!.Name}
            error-message="Name is required"
            .configValue=${'Name'}
            @input=${this._valueChanged}
          >
          </ha-textfield>
        </div>
        <div class="card-actions">
          <mwc-button
            style="float: right"
            .disabled=${this._newScheduleName ? false : true}
            @click=${this.confirmClick}
          >
            ${this._rename_in_progress
              ? html`<span class="waiting"><ha-circular-progress active size="small"></ha-circular-progress></span>`
              : 'OK'}
          </mwc-button>
          <mwc-button @click=${this.cancelClick}> ${'Cancel'} </mwc-button>
        </div>
      </ha-card>
    `;
  }

  async confirmClick(): Promise<void> {
    await this.renameSchedule();
  }

  async renameSchedule(): Promise<void> {
    this._rename_in_progress = true;
    await renameSchedule(this.hass!, this.config!.hub, this.schedule_type!, this.schedule_id!, this._newScheduleName);
    const myEvent = new CustomEvent('scheduleRenamed');
    this.dispatchEvent(myEvent);
    this._rename_in_progress = false;
  }

  cancelClick(): void {
    const myEvent = new CustomEvent('backClick', { detail: EViews.ScheduleEdit });
    this.dispatchEvent(myEvent);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  _valueChanged(ev): void {
    const target = ev.target;
    if (target.configValue) {
      this._newScheduleName = target.value;
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
    `;
  }
}
