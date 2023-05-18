/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, TemplateResult, css, CSSResultGroup } from 'lit';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';

import { ScopedRegistryHost } from '@lit-labs/scoped-registry-mixin';
import { WiserScheduleCardConfig, ScheduleListItem } from './types';
import { customElement, property, state } from 'lit/decorators.js';
import { formfieldDefinition } from '../elements/formfield';
import { selectDefinition } from '../elements/select';
import { switchDefinition } from '../elements/switch';
import { textfieldDefinition } from '../elements/textfield';
import { capitalize } from './helpers';
import { fetchHubs, fetchSchedules } from './data/websockets';
import { CARD_VERSION } from './const';

@customElement('wiser-schedule-card-editor')
export class WiserScheduleCardEditor extends ScopedRegistryHost(LitElement) implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: WiserScheduleCardConfig;
  @state() private _helpers?: any;
  @state() private _hubs?: string[];
  @state() private _schedules?: ScheduleListItem[];

  private _initialized = false;

  static elementDefinitions = {
    ...textfieldDefinition,
    ...selectDefinition,
    ...switchDefinition,
    ...formfieldDefinition,
  };

  public setConfig(config: WiserScheduleCardConfig): void {
    this._config = config;
    this.loadCardHelpers();
  }

  protected shouldUpdate(): boolean {
    if (!this._initialized) {
      this._initialize();
    }
    return true;
  }

  get _name(): string {
    return this._config?.name || '';
  }

  get _hub(): string {
    return this._config?.hub || '';
  }

  get _selected_schedule(): string {
    return this._config?.selected_schedule || '';
  }

  get _theme_colors(): boolean {
    return this._config?.theme_colors || false;
  }

  get _show_badges(): boolean {
    return this._config?.show_badges || false;
  }

  get _show_schedule_id(): boolean {
    return this._config?.show_schedule_id || false;
  }

  get _display_only(): boolean {
    return this._config?.display_only || false;
  }

  get _admin_only(): boolean {
    return this._config?.admin_only || false;
  }

  get _view_type(): string {
    return this._config?.view_type || 'default';
  }

  get _hide_card_borders(): boolean {
    return this._config?.hide_card_borders || false;
  }

  async loadData(): Promise<void> {
    if (this.hass) {
      this._hubs = await fetchHubs(this.hass);
      this._schedules = await fetchSchedules(this.hass, this._hub ? this._hub : this._hubs[0]);
    }
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this._helpers || !this._config || !this._hubs || !this._schedules) {
      return html``;
    }

    return html`
      <mwc-textfield
        label="Title (optional)"
        .value=${this._name}
        .configValue=${'name'}
        @input=${this._valueChanged}
      ></mwc-textfield>
      ${this.hubSelector()}
      <mwc-select
        naturalMenuWidth
        fixedMenuPosition
        label="Schedule (Optional)"
        .configValue=${'selected_schedule'}
        .value=${this._selected_schedule}
        @selected=${this._valueChanged}
        @closed=${(ev) => ev.stopPropagation()}
      >
        <mwc-list-item></mwc-list-item>
        ${this._schedules.map((s) => {
          return html`<mwc-list-item .value=${s.Type + '|' + s.Id}>${s.Name}</mwc-list-item>`;
        })}
      </mwc-select>
      <mwc-select
        naturalMenuWidth
        fixedMenuPosition
        label="View"
        .configValue=${'view_type'}
        .value=${this._view_type}
        @selected=${this._valueChanged}
        @closed=${(ev) => ev.stopPropagation()}
      >
        <mwc-list-item></mwc-list-item>
        ${['default', 'list'].map((s) => {
          return html`<mwc-list-item .value=${s}>${capitalize(s)}</mwc-list-item>`;
        })}
      </mwc-select>
      <mwc-formfield .label=${`Only Allow Display of Schedules`}>
        <mwc-switch
          .checked=${this._display_only !== false}
          .configValue=${'display_only'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Only Allow Admin to Manage Schedules`}>
        <mwc-switch
          ?disabled=${this._display_only === true}
          .checked=${this._admin_only !== false}
          .configValue=${'admin_only'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <br />
      <mwc-formfield .label=${`Use Theme Colors`}>
        <mwc-switch
          .checked=${this._theme_colors !== false}
          .configValue=${'theme_colors'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Hide Card Borders (for stack-in cards)`}>
        <mwc-switch
          .checked=${this._hide_card_borders !== false}
          .configValue=${'hide_card_borders'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <br />
      <p>Default View Options</p>
      <mwc-formfield .label=${`Show Assignment Count Badges`}>
        <mwc-switch
          .checked=${this._show_badges !== false && this._view_type == 'default'}
          .disabled=${this._view_type != 'default'}
          .configValue=${'show_badges'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <mwc-formfield .label=${`Show Schedule IDs`}>
        <mwc-switch
          .checked=${this._show_schedule_id !== false && this._view_type == 'default'}
          .disabled=${this._view_type != 'default'}
          .configValue=${'show_schedule_id'}
          @change=${this._valueChanged}
        ></mwc-switch>
      </mwc-formfield>
      <br />
      <div class="version">Version: ${CARD_VERSION}</div>
    `;
  }

  private hubSelector() {
    const hubs = this._hubs ? this._hubs : [];
    if (hubs.length > 1) {
      return html`
        <mwc-select
          naturalMenuWidth
          fixedMenuPosition
          label="Wiser Hub (Optional)"
          .configValue=${'hub'}
          .value=${this._hub ? this._hub : hubs[0]}
          @selected=${this._valueChanged}
          @closed=${(ev) => ev.stopPropagation()}
        >
          ${this._hubs?.map((hub) => {
            return html`<mwc-list-item .value=${hub}>${hub}</mwc-list-item>`;
          })}
        </mwc-select>
      `;
    }
    return html``;
  }

  private _initialize(): void {
    if (this.hass === undefined) return;
    if (this._config === undefined) return;
    if (this._helpers === undefined) return;
    this._initialized = true;
  }

  private async loadCardHelpers(): Promise<void> {
    this._helpers = await (window as any).loadCardHelpers();
    await this.loadData();
  }

  private _valueChanged(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    if (this[`_${target.configValue}`] === target.value) {
      return;
    }
    if (target.configValue) {
      if (target.value === '') {
        const tmpConfig = { ...this._config };
        delete tmpConfig[target.configValue];
        this._config = tmpConfig;
      } else {
        this._config = {
          ...this._config,
          [target.configValue]: target.checked !== undefined ? target.checked : target.value,
        };
      }
    }
    if (target.configValue === 'hub') {
      this._config.selected_schedule = '';
    }
    fireEvent(this, 'config-changed', { config: this._config });
  }

  static styles: CSSResultGroup = css`
    mwc-select,
    mwc-textfield {
      margin-bottom: 16px;
      display: block;
    }
    mwc-formfield {
      padding-bottom: 20px;
      display: flex;
    }
    mwc-switch {
      --mdc-theme-secondary: var(--switch-checked-color);
    }
  `;
}
