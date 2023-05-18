/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LitElement, html, css, TemplateResult, CSSResultGroup } from 'lit';
import { property, customElement, state } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';
import type { WiserScheduleCardConfig, NewSchedule } from '../types';
import { createSchedule, fetchScheduleTypes } from '../data/websockets';

import '../components/dialog-delete-confirm';
import { localize } from '../localize/localize';

@customElement('wiser-schedule-add-card')
export class ScheduleAddCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public config?: WiserScheduleCardConfig;
  @property({ attribute: false }) public component_loaded = false;

  @state() private _schedule_types: string[] = [];
  @state() private _schedule_info?: NewSchedule = { Name: '', Type: 'Heating' };

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
    this._schedule_types = await fetchScheduleTypes(this.hass!, this.config!.hub);
  }

  render(): TemplateResult {
    if (!this.hass || !this.config) return html``;
    return html`
      <div>
        <div>${localize('wiser.actions.add_schedule')}</div>
        <div class="wrapper" style="white-space: normal">${localize('wiser.helpers.add_schedule')}</div>
        <div class="wrapper">${this._schedule_types.map((t, i) => this.renderScheduleTypeButtons(t, i))}</div>
        <ha-textfield
          class="schedule-name"
          auto-validate
          required
          label=${localize('wiser.headings.schedule_name')}
          error-message=${localize('wiser.common.name_required')}
          .configValue=${'Name'}
          @input=${this._valueChanged}
        >
        </ha-textfield>
      </div>
      <div class="card-actions">
        <mwc-button
          style="float: right"
          .disabled=${this._schedule_info && this._schedule_info.Name ? false : true}
          @click=${this.confirmClick}
          dialogAction="close"
        >
          ${this.hass.localize('ui.common.save')}
        </mwc-button>
        <mwc-button @click=${this.cancelClick}> ${this.hass.localize('ui.common.cancel')} </mwc-button>
      </div>
    `;
  }

  renderScheduleTypeButtons(schedule_type: string, index: number): TemplateResult {
    return html`
      <mwc-button
        id=${index}
        class=${this._schedule_info && this._schedule_info.Type == schedule_type ? 'active' : 'inactive'}
        @click=${this._valueChanged}
        .configValue=${'Type'}
        .value=${schedule_type}
      >
        ${schedule_type}
      </mwc-button>
    `;
  }

  async confirmClick(): Promise<void> {
    await this.createSchedule();
  }

  async createSchedule(): Promise<void> {
    await createSchedule(this.hass!, this.config!.hub, this._schedule_info!.Type, this._schedule_info!.Name);
    const myEvent = new CustomEvent('scheduleAdded');
    this.dispatchEvent(myEvent);
  }

  cancelClick(): void {
    const myEvent = new CustomEvent('backClick');
    this.dispatchEvent(myEvent);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  _valueChanged(ev): void {
    const target = ev.target;
    if (target.configValue) {
      this._schedule_info = {
        ...this._schedule_info!,
        [target.configValue]: target.checked !== undefined ? target.checked : target.value,
      };
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
