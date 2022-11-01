/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, css, CSSResultGroup } from 'lit';
import { property, customElement, state } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';
import { mdiClose } from '@mdi/js';
import { localize } from '../localize/localize';

@customElement('wiser-dialog-delete-confirm')
export class DialogDeleteConfirm extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @state() private _params?: any;

  public async showDialog(params: any): Promise<void> {
    this._params = params;
    await this.updateComplete;
  }

  public async closeDialog() {
    if (this._params) this._params.cancel();
    this._params = undefined;
  }

  render() {
    if (!this._params) return html``;
    return html`
      <ha-dialog open .heading=${true} @closed=${this.closeDialog} @close-dialog=${this.closeDialog}>
        <div slot="heading">
          <ha-header-bar>
            <ha-icon-button slot="navigationIcon" dialogAction="cancel" .path=${mdiClose}> </ha-icon-button>
            <span slot="title"> ${localize('wiser.headings.delete_schedule')} </span>
          </ha-header-bar>
        </div>
        <div class="wrapper">${localize('wiser.helpers.delete_schedule_confirm') + ' ' + this._params.name + '?'}</div>
        <mwc-button
          class="warning"
          slot="primaryAction"
          style="float: left"
          @click=${this.confirmClick}
          dialogAction="close"
        >
          ${this.hass.localize('ui.common.delete')}
        </mwc-button>
        <mwc-button slot="secondaryAction" @click=${this.cancelClick} dialogAction="close">
          ${this.hass.localize('ui.common.cancel')}
        </mwc-button>
      </ha-dialog>
    `;
  }

  confirmClick() {
    this._params.confirm();
  }

  cancelClick() {
    this._params.cancel();
  }

  static get styles(): CSSResultGroup {
    return css`
      div.wrapper {
        color: var(--primary-text-color);
      }
      mwc-button.warning {
        --mdc-theme-primary: var(--error-color);
      }
    `;
  }
}
