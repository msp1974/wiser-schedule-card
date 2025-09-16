import { LitElement, html, css, CSSResultGroup, TemplateResult } from 'lit';
import { property, customElement, state } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';
import { mdiClose } from '@mdi/js';

@customElement('wiser-dialog-error')
export class DialogError extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @state() private _params?: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  public async showDialog(params: any): Promise<void> {
    this._params = params;
    await this.updateComplete;
  }

  public async closeDialog(): Promise<void> {
    this._params = undefined;
  }

  render(): TemplateResult {
    if (!this._params) return html``;
    return html`
      <ha-dialog
        open
        .heading=${this._params.title || this.hass.localize('state_badge.default.error')}
        @closed=${this.closeDialog}
        @close-dialog=${this.closeDialog}
      >
        <div class="wrapper">${this._params.error || ''}</div>
        <ha-button slot="primaryAction" style="float: left" @click=${this.closeDialog} dialogAction="close">
          ${this.hass.localize('ui.dialogs.generic.ok')}
        </ha-button>
      </ha-dialog>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      div.wrapper {
        color: var(--primary-text-color);
      }
    `;
  }
}
