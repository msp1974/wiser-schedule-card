/* eslint-disable @typescript-eslint/no-explicit-any */
import { LitElement, html, css, TemplateResult, CSSResultGroup } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';

import { getLocale } from '../helpers';
import { formatAmPm, formatTime } from '../data/date-time/format_time';
import { timeToString } from '../data/date-time/time';
import { stringToDate } from '../data/date-time/string_to_date';

const SEC_PER_HOUR = 3600;

@customElement('wiser-time-bar')
export class TimeBar extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  protected render(): TemplateResult {
    return html` <div id="time-bar" class="time-wrapper">${this.renderTimes()}</div> `;
  }

  renderTimes(): TemplateResult | TemplateResult[] {
    if (this.hass) {
      const fullWidth = parseFloat(getComputedStyle(this).getPropertyValue('width')) || 460;
      const allowedStepSizes = [1, 2, 3, 4, 6, 8, 12];
      const segmentWidth = formatAmPm(getLocale(this.hass)) ? 55 : 40;
      let stepSize = Math.ceil(24 / (fullWidth / segmentWidth));
      while (!allowedStepSizes.includes(stepSize)) stepSize++;

      const nums = [0, ...Array.from(Array(24 / stepSize - 1).keys()).map((e) => (e + 1) * stepSize), 24];

      return nums.map((e) => {
        const isSpacer = e == 0 || e == 24;
        const w = isSpacer ? (stepSize / 48) * 100 : (stepSize / 24) * 100;
        return html`
          <div style="width: ${Math.floor(w * 100) / 100}%" class="${isSpacer ? '' : 'time'}">
            ${!isSpacer
              ? formatTime(
                  stringToDate(timeToString(e * SEC_PER_HOUR)),
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  getLocale(this.hass!),
                )
              : ''}
          </div>
        `;
      });
    }
    return html``;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
        max-width: 100%;
        overflow: hidden;
      }
      div.outer {
        width: 100%;
        overflow-x: hidden;
        overflow-y: hidden;
        border-radius: 5px;
      }
      div.time-wrapper {
        white-space: nowrap;
        transition: width 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67), margin 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67);
        overflow: auto;
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
      @keyframes fadeIn {
        99% {
          visibility: hidden;
        }
        100% {
          visibility: visible;
        }
      }
    `;
  }
}
