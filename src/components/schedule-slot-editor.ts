/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LitElement, html, css, TemplateResult, CSSResultGroup } from 'lit';
import { createRef, Ref } from 'lit/directives/ref'
import { property, customElement, state, eventOptions } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';

import { mdiRadiatorOff, mdiUnfoldMoreVertical } from '@mdi/js';

import type { WiserScheduleCardConfig, ScheduleSlot, Schedule, ScheduleDay, SunTimes } from '../types';
import { color_map, getLocale, get_end_time, get_setpoint, stringTimeToSeconds } from '../helpers';
import { HEATING_TYPES, SEC_PER_DAY, day_short_width, days, days_short, DefaultSetpoint, SetpointUnits, SPECIAL_TIMES, SUPPORT_SPECIAL_TIMES, SPECIAL_DAYS, weekdays, weekends } from '../const';
import './dialog-delete-confirm';
import { parseRelativeTime, roundTime, stringToTime, timeToString } from '../data/date-time/time';
import { formatTime, TimeFormat } from '../data/date-time/format_time';
import { stringToDate } from '../data/date-time/string_to_date';
import { absToRelTime } from '../data/date-time/relative-time';
import './variable-slider';
import './time-bar'
import { localize } from '../localize/localize';


@customElement('wiser-schedule-slot-editor')
export class ScheduleSlotEditor extends LitElement {
    @property({ attribute: false }) public hass?: HomeAssistant;
    @property({ attribute: false }) config?: WiserScheduleCardConfig;

    @property({ attribute: false }) schedule?: Schedule;
    @property({ attribute: false }) suntimes?: SunTimes;

    @property({ attribute: false }) editMode = false;

    @state() _activeSlot = -99;
    @state() _activeDay = '';
    @state() _show_short_days = false;

    schedule_type?: string = HEATING_TYPES[0];
    activeMarker: number | null = 0;
    isDragging = false;
    currentTime = 0;
    timer = 0;
    timeout = 0;
    zoomFactor = 1;
    switchRef: Ref<HTMLElement> = createRef();

    @state() rangeMin = 0; //lower bound of zoomed timeframe

    @state() rangeMax: number = SEC_PER_DAY; //upper bound of zoomed timeframe

    @state() stepSize = 5;

    constructor() {
        super();
        this.initialise();
    }

    async initialise(): Promise<boolean> {
        if (this.schedule) { this.schedule_type = this.schedule.Type }
        return true
    }

    protected shouldUpdate(): boolean {
        if (!this.editMode) {
            this._activeSlot = -99;
            this._activeDay = '';
        }
        return true
    }


    render(): TemplateResult {
        const fullWidth = parseFloat(getComputedStyle(this).getPropertyValue('width'));
        this._show_short_days = (fullWidth < day_short_width)
        if (!this.hass || !this.config || !this.suntimes || !this.schedule) return html``;
        return html`
            <div class = "slots-wrapper">
                ${days.map(day => this.renderDay(
                    this.schedule!.ScheduleData.filter(rday => rday.day == day)[0]
                        ? this.schedule!.ScheduleData.filter(rday => rday.day == day)[0]
                        : { "day": day, "slots": [] }
                ))}
                <div class="wrapper" style="display:flex; height:28px;">
                    <div class="day  ${this._show_short_days ? 'short' : ''}">&nbsp;</div>
                        <wiser-time-bar style="width:100%"
                            .hass=${this.hass}
                            ></wiser-time-bar>
                    </div>
                </div>
            </div>
            ${this.editMode && SUPPORT_SPECIAL_TIMES.includes(this.schedule_type!) ? this.renderSpecialTimeButtons(): null}
            ${this.editMode ? this.renderAddDeleteButtons() : null}
            ${this.editMode ? this.renderSetPointControl(): null}
            ${this.editMode ? this.renderCopyDay(): null}
        `;


    }

    renderDay(day: ScheduleDay): TemplateResult {
        const slot: ScheduleSlot = { 'Time': '23:59', 'Setpoint': '0' , 'SpecialTime': ''}
        return html`
            <div class="wrapper">
                ${this.computeDayLabel(day.day)}
                <div class="outer" id="${day.day}">
                    <div class="wrapper selectable">
                        ${day.slots.length > 0 ? day.slots.map((slot, index) => this.renderSlot(slot, index, day)) : this.renderEmptySlot(slot, -1, day, true)}
                    </div>
                </div>
            </div>
        `;
    }

    renderEmptySlot(slot: ScheduleSlot, index: number, day: ScheduleDay, onlySlot = false) {
        const start_time = '00:00'
        const end_time = slot.Time
        const setpoint = get_setpoint(day, index, this.schedule!)
        const fullWidth = parseFloat(getComputedStyle(this).getPropertyValue('width'));
        const colour = (this.config!.theme_colors ? 'rgba(var(--rgb-primary-color), 0.7)' : 'rgba(' + color_map(this, this.schedule_type!, setpoint) + ')');
        const width = ((stringTimeToSeconds(end_time) - stringTimeToSeconds(start_time)) / SEC_PER_DAY) * 100;
        const title = 'Start - ' + start_time + '\nEnd - ' + end_time + '\nSetting - ' + this.computeSetpointLabel(setpoint);
        const label_class = (width / 100) * fullWidth < 35 ? 'setpoint rotate' : 'setpoint';
        return html`
        <div
            id=${day.day + '|-1'}
            class="slot previous ${this.editMode && onlySlot ? 'selectable':null} ${this._activeSlot == index && this._activeDay == day.day ? 'selected':null} ${this.config!.theme_colors ? 'theme-colors': null}"
            style="width:${Math.floor(width * 1000) / 1000}%; background:${colour};"
            title='${title}'
            @click=${onlySlot ? this._slotClick : null}
            slot="${-1}"
            >
            <div class="slotoverlay previous">
                <span class="${label_class}">${this.computeSetpointLabel(setpoint)}</span>
            </div>
        </div>
    `;
    }

    renderSlot(slot: ScheduleSlot, index: number, day: ScheduleDay) {
        const start_time = slot.Time
        const end_time = get_end_time(day, index)
        const setpoint = slot.Setpoint
        const width = ((stringTimeToSeconds(end_time) - stringTimeToSeconds(start_time)) / SEC_PER_DAY) * 100;
        const colour = (this.config!.theme_colors ? 'rgba(var(--rgb-primary-color), 0.7)' : 'rgba(' + color_map(this, this.schedule_type!, setpoint) + ')');
        const fullWidth = parseFloat(getComputedStyle(this).getPropertyValue('width'));
        const label_class = (width / 100) * fullWidth < 35 ? 'setpoint rotate' : 'setpoint';
        const title = 'Start - ' + (slot.SpecialTime ? slot.SpecialTime + ' (' + start_time + ')' : start_time) + '\nEnd - ' + end_time + '\nSetting - ' + this.computeSetpointLabel(setpoint);

        return html`
            ${index == 0 && start_time != '00:00' && start_time !='0:00' ? this.renderEmptySlot(slot, -1, day, false) : ''}
            <div
                id=${day.day + '|' + index}
                class="slot ${this.editMode ? 'selectable':null} ${this._activeSlot == index && this._activeDay == day.day ? 'selected':null}"
                style="width:${Math.floor(width * 1000) / 1000}%; background:${colour};"
                title='${title}'
                @click=${this._slotClick}
                slot="${index}"
                >

                <div class="slotoverlay ${this.editMode ? 'selectable': null}">
                    <span class="${label_class}">${this.computeSetpointLabel(setpoint)}</span>
                </div>
                ${this._activeSlot == index && this._activeDay == day.day
                ? html`
                    <div class="handle">
                    <div class="button-holder">
                        <ha-icon-button
                        .path=${mdiUnfoldMoreVertical}
                        @mousedown=${this._handleTouchStart}
                        @touchstart=${this._handleTouchStart}
                        >
                        </ha-icon-button>
                    </div>
                    </div>
                `
                : ''}
                ${this._activeSlot == index  && this._activeDay == day.day ? this.renderTooltip(day, index) : ''}
            </div>
        `;
    }

    renderSpecialTimeButtons(): TemplateResult {
        const slot = this._activeDay ? this.schedule!.ScheduleData.filter(rday => rday.day == this._activeDay)[0].slots[this._activeSlot] : null;
        return html`
            <div class="wrapper special-times" style="white-space: normal;">
                <div class="sub-heading">Set Special Time</div>
                <mwc-button
                    id=${'sunrise'}
                    @click=${this._setSpecialTime}
                    ?disabled=${!slot}
                >
                    <ha-icon id=${'sunrise'} icon="hass:weather-sunny" class="padded-right"></ha-icon>
                    Sunrise
                </mwc-button>
                <mwc-button
                    id=${'sunset'}
                    @click=${this._setSpecialTime}
                    ?disabled=${!slot}
                >
                    <ha-icon id=${'sunset'} icon="hass:weather-night" class="padded-right"></ha-icon>
                    Sunset
                </mwc-button>
            </div>
        `;
    }

    renderAddDeleteButtons(): TemplateResult {
        let slotCount = 0;
        if (this.schedule!.ScheduleData.filter(day => day.day == this._activeDay).length > 0) {
            slotCount = this._activeDay ? this.schedule!.ScheduleData.filter(day => day.day == this._activeDay)[0].slots.length : 0;
        }
        return html`
                <div class="wrapper" style="white-space: normal;">
                    <div class="day  ${this._show_short_days ? 'short':''}">&nbsp;</div>
                    <div class="sub-section">
                        <mwc-button
                            id=${'add-before'}
                            @click=${this._addSlot}
                            ?disabled=${this._activeSlot < 0 || slotCount >= 24}
                        >
                            <ha-icon id=${'add-before'} icon="hass:plus-circle-outline" class="padded-right"></ha-icon>
                            ${localize('wiser.actions.add_before')}
                        </mwc-button>
                        <mwc-button
                            id=${'add-after'}
                            @click=${this._addSlot}
                            ?disabled=${this._activeSlot < -1 || slotCount >= 24}
                        >
                            <ha-icon id=${'add-after'} icon="hass:plus-circle-outline" class="padded-right"></ha-icon>
                            ${localize('wiser.actions.add_after')}
                        </mwc-button>
                        <mwc-button
                            @click=${this._removeSlot}
                            ?disabled=${this._activeSlot < 0 || slotCount < 1}
                        >
                            <ha-icon icon="hass:minus-circle-outline" class="padded-right"></ha-icon>
                            ${this.hass!.localize('ui.common.delete')}
                        </mwc-button>
                    </div>
                </div>
            `;
        //}
        //return html``;
    }

    renderSetPointControl(): TemplateResult {
        let slots = {};
        if (this.editMode) {
            if (this.schedule!.ScheduleData.filter(day => day.day == this._activeDay).length > 0) {
                slots = this._activeDay ? this.schedule!.ScheduleData.filter(rday => rday.day == this._activeDay)[0].slots : {};
            }
            if (this.schedule_type == 'Heating') {
                return html`
                    <div class="wrapper" style="white-space: normal; padding-top: 10px;">
                        <div class="day  ${this._show_short_days ? 'short' : ''}">&nbsp;</div>
                        <div class="sub-section">
                            <div class="section-header">Temp</div>
                            <br />
                            <div style="display: flex; line-height: 32px; width: 100%">
                                <ha-icon-button
                                    class="set-off-button"
                                    .path=${mdiRadiatorOff}
                                    .disabled=${this._activeSlot < 0 }
                                    @click=${() => this._updateSetPoint('-20')}
                                > </ha-icon-button>
                                <wiser-variable-slider
                                    min="5"
                                    max="30"
                                    step="0.5"
                                    value=${this._activeSlot >= 0 ? parseFloat(slots![this._activeSlot!].Setpoint) : 0}
                                    unit="°C"
                                    .optional=${false}
                                    .disabled=${this._activeSlot < 0 }
                                    @value-changed=${(ev: CustomEvent) => { this._updateSetPoint(Number(ev.detail.value)); }}
                                >
                                </wiser-variable-slider>
                            </div>
                        </div>
                    </div>
                `;
            } else if (this.schedule_type == 'OnOff') {
                return html`
                    <div class="wrapper" style="white-space: normal; height: 36px;">
                        <div class="day  ${this._show_short_days ? 'short' : ''}">&nbsp;</div>
                        <div class="sub-section">
                            <div class="section-header">State</div>
                            <div>
                                <mwc-button id="state-off"
                                    class="state-button active"
                                    .disabled=${this._activeSlot < 0 || slots[this._activeSlot!].Setpoint == 'Off' ? true : false}
                                    @click=${() => this._updateSetPoint('Off')}
                                    >
                                    Off
                                </mwc-button>
                                <mwc-button id="state-on"
                                    class="state-button active"
                                    .disabled=${this._activeSlot < 0 || slots[this._activeSlot!].Setpoint == 'On' ? true : false}
                                    @click=${() => this._updateSetPoint('On')}
                                    >
                                    On
                                </mwc-button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (['Lighting', 'Shutters'].includes(this.schedule_type!)) {
                return html`
                    <div class="wrapper" style="white-space: normal;">
                        <div class="day  ${this._show_short_days ? 'short' : ''}">&nbsp;</div>
                        <div class="sub-section">
                            <div class="section-header">Level</div>
                            <div>
                                <wiser-variable-slider
                                    min="0"
                                    max="100"
                                    step="1"
                                    value=${this._activeSlot >= 0 ? parseInt(slots![this._activeSlot!].Setpoint) : 0}
                                    unit="%"
                                    .optional=${false}
                                    .disabled=${this._activeSlot < 0}
                                    @value-changed=${(ev: CustomEvent) => { this._updateSetPoint(Number(ev.detail.value)); }}
                                >
                                </wiser-variable-slider>
                            </div>
                        </div>
                    </div>
                `;
            }
            return html``;
        }
        return html``;
    }

    renderCopyDay(): TemplateResult {
            return html`
                <div class="wrapper" style="white-space: normal; padding-top: 10px;">
                    <div class="day  ${this._show_short_days ? 'short' : ''}">&nbsp;</div>
                    <div>
                        <div class="section-header">
                            ${this._activeDay ? 'Copy ' + this._activeDay + ' to' : 'Select day to enable copy'}
                        </div>
                        <div>
                            ${(days.concat(SPECIAL_DAYS)).map(day => this.renderCopyToButton(day))}
                        </div>
                    </div>
                </div>
            `;
    }

    renderCopyToButton(day: string): TemplateResult {
        return html`
            <mwc-button
                id=${day}
                @click=${this._copyDay}
                ?disabled=${this._activeDay == day || !this._activeDay}
            >
                ${days.includes(day) ? days_short[days.indexOf(day)] : day}
            </mwc-button>
        `;
    }

    renderTooltip(day: ScheduleDay, i: number): TemplateResult {
        const slots = day.slots;
        const res = SPECIAL_TIMES.includes(slots![i].SpecialTime);
        return html`
          <div class="tooltip-container center">
            <div
              class="tooltip ${this._activeSlot === i ? 'active' : ''}"
              @click=${this._selectMarker}
            >
              ${res
                ? html`
                    <ha-icon
                      icon="hass:${slots![i].SpecialTime == SPECIAL_TIMES[0]
                        ? 'weather-sunny'
                        : 'weather-night'}"
                    ></ha-icon>
                    ${slots![i].SpecialTime}
                  `
                : slots![i].Time}
            </div>
          </div>
        `;
    }

    private _slotClick(ev): void {
        const target = ev.target.parentElement.parentElement
        if (target.id) {
            const day = target.id.split('|')[0];
            const slot = target.id.split('|')[1];
            if (!(slot == this._activeSlot && day == this._activeDay)) {
                this._activeSlot = parseInt(slot);
                this._activeDay = day;
            } else {
                this._activeSlot = -99;
                this._activeDay = '';
            }
            const myEvent = new CustomEvent('slotClicked', {
                detail: { day: this._activeDay, slot: this._activeSlot },
            });
            this.dispatchEvent(myEvent);
        }
    }

    private _copyDay(ev): void {
        const target = ev.target
        const slotData = JSON.stringify(this.schedule!.ScheduleData[days.indexOf(this._activeDay!)].slots)
        if (days.includes(target.id)) {
            this.schedule!.ScheduleData[days.indexOf(target.id)].slots = JSON.parse(slotData)
        } else if(target.id == SPECIAL_DAYS[0]) {
            weekdays.map(day => {
                this.schedule!.ScheduleData[days.indexOf(day)].slots = JSON.parse(slotData)
            })
        } else if(target.id == SPECIAL_DAYS[1]) {
            weekends.map(day => {
                this.schedule!.ScheduleData[days.indexOf(day)].slots = JSON.parse(slotData)
            })
        }
        this.requestUpdate();
    }

    _updateSetPoint(setpoint: string | number): void {
        this.schedule!.ScheduleData[days.indexOf(this._activeDay!)].slots = Object.assign(
            this.schedule!.ScheduleData[days.indexOf(this._activeDay!)].slots,
            {
                [this._activeSlot!]: {
                    ...this.schedule!.ScheduleData[days.indexOf(this._activeDay!)].slots![this._activeSlot!],
                    Setpoint: setpoint,
                }
            },
        );
        const myEvent = new CustomEvent('scheduleChanged', {
            detail: { schedule: this.schedule },
        });
        this.dispatchEvent(myEvent);
        this.requestUpdate();
    }

    getSunTime(day: string, time: string): string {
        if (time == SPECIAL_TIMES[0]) {
            return this.suntimes!.Sunrises[days.indexOf(day)].time
        }
        return this.suntimes!.Sunsets[days.indexOf(day)].time
    }

    convertScheduleDay(day: ScheduleDay): ScheduleDay {
        const slots = day.slots;
        const outputSlots: ScheduleSlot[] = slots.map((slot) => {
            return SPECIAL_TIMES.includes(slot.SpecialTime) ?
                { "Time": this.getSunTime(day.day, slot.SpecialTime), "Setpoint": slot.Setpoint, "SpecialTime": slot.SpecialTime }
                : { "Time": slot.Time, "Setpoint": slot.Setpoint, "SpecialTime": slot.SpecialTime }
        }).sort((a, b) => parseInt(a.Time.replace(':', '')) < parseInt(b.Time.replace(':', '')) ? 0 : 1)

        const outputSlotsSet = new Set(outputSlots.map(e => JSON.stringify(e)));
        const res = Array.from(outputSlotsSet).map(e => JSON.parse(e));
        const outputDay: ScheduleDay = { "day": day.day, "slots": res };
        return outputDay;

    }

    private _setSpecialTime(ev) {
        const titleCase = (str) => {
            return str.replace(/\w\S*/g, (t) => { return t.charAt(0).toUpperCase() + t.substr(1).toLowerCase() });
          }
        const specialTime = titleCase(ev.target.id)
        if (this._activeDay && this._activeSlot >= 0) {
            if (this.schedule!.ScheduleData[days.indexOf(this._activeDay!)].slots[this._activeSlot].SpecialTime != specialTime) {
                this.schedule!.ScheduleData[days.indexOf(this._activeDay!)].slots = Object.assign(
                    this.schedule!.ScheduleData[days.indexOf(this._activeDay!)].slots,
                    {
                        [this._activeSlot!]: {
                            ...this.schedule!.ScheduleData[days.indexOf(this._activeDay!)].slots![this._activeSlot!],
                            SpecialTime: specialTime,
                            Time: this.getSunTime(this._activeDay, specialTime),
                        }
                    },
                );
            }

            //Resort slots
            this.schedule!.ScheduleData[days.indexOf(this._activeDay!)] = this.convertScheduleDay(this.schedule!.ScheduleData[days.indexOf(this._activeDay!)])

            //Set correct active slot
            this.schedule!.ScheduleData[days.indexOf(this._activeDay!)].slots.forEach((slot, i) => {
                if (slot.SpecialTime == specialTime) {this._activeSlot = i}
            })
            this.requestUpdate();
        }
    }

    private _addSlot(ev) {
        const add_before = ev.target.id === 'add-before' ? true : false;
        if (this._activeSlot < -1) return;

        const activeDayIndex = days.indexOf(this._activeDay)
        if (this._activeSlot < 0) {
            this.schedule!.ScheduleData[activeDayIndex].slots = [
                {
                    Time: formatTime(
                        stringToDate(timeToString(stringToTime('06:00', this.hass!))),
                        getLocale(this.hass!)
                    ).padStart(5, '0'),
                    Setpoint: DefaultSetpoint[this.schedule_type!],
                    SpecialTime: ''
                }
            ];
            this._activeSlot = 0;
        } else {
            const activeSlot = this.schedule!.ScheduleData[activeDayIndex].slots[this._activeSlot];
            let startTime = stringToTime(activeSlot.Time, this.hass!);
            let endTime = stringToTime(get_end_time(this.schedule!.ScheduleData[activeDayIndex], this._activeSlot), this.hass!);
            if (endTime < startTime) endTime += SEC_PER_DAY;
            const newStop = roundTime(startTime + (endTime - startTime) / 2, this.stepSize);

            if (add_before) {
                if (!activeSlot.SpecialTime) {
                    console.log("Normal path", activeSlot)
                    this.schedule!.ScheduleData[activeDayIndex].slots = [
                        ...this.schedule!.ScheduleData[activeDayIndex].slots.slice(0, this._activeSlot),
                        {
                            Time: formatTime(
                                stringToDate(timeToString(startTime)),
                                getLocale(this.hass!)
                            ).padStart(5, '0'),
                            Setpoint: DefaultSetpoint[this.schedule_type!],
                            SpecialTime: ''
                        },
                        {
                            ...this.schedule!.ScheduleData[activeDayIndex].slots[this._activeSlot!], Time: formatTime(
                                stringToDate(timeToString(newStop)),
                                getLocale(this.hass!)
                            ),
                        },
                        ...this.schedule!.ScheduleData[activeDayIndex].slots.slice(this._activeSlot + 1),
                    ];
                } else {
                    startTime = roundTime(startTime - stringToTime('01:00', this.hass!), this.stepSize)
                    this.schedule!.ScheduleData[activeDayIndex].slots = [
                        ...this.schedule!.ScheduleData[activeDayIndex].slots.slice(0, this._activeSlot),
                        {
                            Time: formatTime(
                                stringToDate(timeToString(startTime)),
                                getLocale(this.hass!)
                            ).padStart(5, '0'),
                            Setpoint: DefaultSetpoint[this.schedule_type!],
                            SpecialTime: ''
                        },
                        ...this.schedule!.ScheduleData[activeDayIndex].slots.slice(this._activeSlot),
                    ];
                }
            } else {
                this.schedule!.ScheduleData[activeDayIndex].slots = [
                    ...this.schedule!.ScheduleData[activeDayIndex].slots.slice(0, this._activeSlot + 1),
                    {
                        Time: formatTime(
                            stringToDate(timeToString(newStop)),
                            getLocale(this.hass!)
                        ).padStart(5, '0'),
                        Setpoint: DefaultSetpoint[this.schedule_type!],
                        SpecialTime: ''
                    },
                    ...this.schedule!.ScheduleData[activeDayIndex].slots!.slice(this._activeSlot + 1),
                ];
                this._activeSlot++;
            }
        }
        const myEvent = new CustomEvent('scheduleChanged', {
            detail: { schedule: this.schedule },
        });
        this.dispatchEvent(myEvent);
        this.requestUpdate();
      }

    private _removeSlot() {
        if (this._activeSlot < 0) return;
        const activeDayIndex = days.indexOf(this._activeDay)
        const cutIndex = this._activeSlot!;
        if (cutIndex == 0) {
            this.schedule!.ScheduleData[activeDayIndex].slots = [
                ...this.schedule!.ScheduleData[activeDayIndex].slots.slice(cutIndex + 1)
            ];
        } else {
            this.schedule!.ScheduleData[activeDayIndex].slots = [
                ...this.schedule!.ScheduleData[activeDayIndex].slots!.slice(0, cutIndex),
                ...this.schedule!.ScheduleData[activeDayIndex].slots.slice(cutIndex +1),
            ];
        }
        if (this._activeSlot == this.schedule!.ScheduleData[activeDayIndex].slots.length) this._activeSlot!--;
        const myEvent = new CustomEvent('scheduleChanged', {
            detail: { schedule: this.schedule },
        });
        this.dispatchEvent(myEvent);
        this.requestUpdate();
      }

    @eventOptions({ passive: true })
    private _handleTouchStart(ev: MouseEvent | TouchEvent) {
        const activeDayIndex = days.indexOf(this._activeDay)
        let slots = this.schedule!.ScheduleData.filter(rday => rday.day == this._activeDay)[0].slots;
        const marker = ev.target as HTMLElement;
        let m = marker;
        while (!m.classList.contains('outer')) m = m.parentElement as HTMLElement;

        const fullWidth = parseFloat(getComputedStyle(m).getPropertyValue('width'));
        const width = (SEC_PER_DAY / (this.rangeMax - this.rangeMin)) * fullWidth;
        const left = (-this.rangeMin / (this.rangeMax - this.rangeMin)) * fullWidth;
        const Toffset = (-left / width) * SEC_PER_DAY;

        let el = marker;
        while (!el.classList.contains('slot')) el = el.parentElement as HTMLElement;

        const rightSlot = el;
        const i = Number(rightSlot.getAttribute('slot'));

        const Tmin =
        i > 0 ? stringToTime(slots![i-1].Time, this.hass!) + 60 * this.stepSize : 0;

        const Tmax =
        i < slots!.length - 1
            ? (stringToTime(get_end_time(this.schedule!.ScheduleData[activeDayIndex], i)!, this.hass!) || SEC_PER_DAY) -
            60 * this.stepSize
            : SEC_PER_DAY - (this.stepSize * 60);

        this.isDragging = true;

        const trackElement = (rightSlot.parentElement as HTMLElement)
        .parentElement as HTMLElement;
        const trackCoords = trackElement.getBoundingClientRect();

        let mouseMoveHandler = (ev: MouseEvent | TouchEvent) => {
        let startDragX;

        if (typeof TouchEvent !== 'undefined') {
            if (ev instanceof TouchEvent) startDragX = ev.changedTouches[0].pageX;
            else startDragX = ev.pageX;
        } else startDragX = (ev as MouseEvent).pageX;

        let x = startDragX - trackCoords.left;
        if (x > fullWidth - 1) x = fullWidth - 1;
        if (x < -18) x = -18;
        let time = Math.round((x / width) * SEC_PER_DAY + Toffset);

        if (time < Tmin) time = Tmin;
        if (time > Tmax) time = Tmax;

            this.currentTime = time;


        const relTime = parseRelativeTime(get_end_time(this.schedule!.ScheduleData[activeDayIndex],i));
        let timeString;
            if (relTime) {
                timeString = absToRelTime(timeToString(time), relTime.event, this.hass!, {
                    stepSize: this.stepSize,
                });
            } else {
            time =
            Math.round(time) >= SEC_PER_DAY ? SEC_PER_DAY : roundTime(time, this.stepSize);
                timeString = formatTime(stringToDate(timeToString(time)), getLocale(this.hass!)).padStart(5,'0');
        }

        if (timeString == get_end_time(this.schedule!.ScheduleData[activeDayIndex], i)) return;


        slots = Object.assign(slots, {
            [i]: {
            ...slots![i],
            Time: timeString,
            SpecialTime: '',
            },
        });
        this.requestUpdate();
        };

        const mouseUpHandler = () => {
        window.removeEventListener('mousemove', mouseMoveHandler);
        window.removeEventListener('touchmove', mouseMoveHandler);
        window.removeEventListener('mouseup', mouseUpHandler);
        window.removeEventListener('touchend', mouseUpHandler);
        window.removeEventListener('blur', mouseUpHandler);
        mouseMoveHandler = () => {
            /**/
        };
        setTimeout(() => {
            this.isDragging = false;
        }, 100);
        marker.blur();
        const myEvent = new CustomEvent('scheduleChanged', {
            detail: { schedule: this.schedule },
        });
        this.dispatchEvent(myEvent);
        };

        window.addEventListener('mouseup', mouseUpHandler);
        window.addEventListener('touchend', mouseUpHandler);
        window.addEventListener('blur', mouseUpHandler);
        window.addEventListener('mousemove', mouseMoveHandler);
        window.addEventListener('touchmove', mouseMoveHandler);
    }

    private _selectMarker(ev: Event, enable = true) {
        ev.stopImmediatePropagation();
        let el = ev.target as HTMLElement;
        while (!el.classList.contains('slot')) el = el.parentElement as HTMLElement;
        const slot = Number(el.getAttribute('slot'));
        if (enable && this.activeMarker === slot) this.activeMarker = null;
        else this.activeMarker = enable ? slot : null;
        const myEvent = new CustomEvent('update', {
          detail: { entry: this._activeSlot, marker: this.activeMarker },
        });
        this.dispatchEvent(myEvent);
        this._updateTooltips();
    }

    private _updateTooltips() {
        const fullWidth = parseFloat(getComputedStyle(this).getPropertyValue('width'));
        const tooltips = (this.shadowRoot?.querySelectorAll(
          '.tooltip'
        ) as unknown) as HTMLElement[];

        const getBounds = (el: HTMLElement) => {
          const width = el.offsetWidth;
          const left = el.parentElement!.offsetLeft + el.offsetLeft - 15;
          if (el.parentElement!.classList.contains('left'))
            return [left + width / 2, left + (3 * width) / 2];
          else if (el.parentElement!.classList.contains('right'))
            return [left - width / 2, left + width / 2];
          return [left, left + width];
        };

        tooltips?.forEach((tooltip, i) => {
            const container = tooltip.parentElement!;
            const visible = container.classList.contains('visible');
            const slot = Number(container.parentElement!.getAttribute('slot'));

          if (slot != this._activeSlot && slot - 1 != this._activeSlot) {
            if (visible) container.classList.remove('visible');
          } else {
            const left = tooltip.parentElement!.offsetLeft;
            if (left < 0 || left > fullWidth + 15) {
              if (visible) container.classList.remove('visible');
            } else {
              if (!visible) container.classList.add('visible');
              const width = container.offsetWidth;
              const isCenter = container.classList.contains('center');
              let marginLeft = getBounds(tooltip)[0],
                marginRight = fullWidth - getBounds(tooltip)[1];

              if (i > 0 && slot - 1 == this._activeSlot)
                marginLeft -= getBounds(tooltips[i - 1])[1];
              else if (i + 1 < tooltips.length && slot == this._activeSlot) {
                const w = getBounds(tooltips[i + 1])[0];
                marginRight -= w < 0 ? 0 : fullWidth - w;
              }

              if (marginLeft < marginRight) {
                if (marginLeft < 0) {
                  if (isCenter && marginRight > width / 2) {
                    container.classList.add('right');
                    container.classList.remove('center');
                    container.classList.remove('left');
                  }
                } else {
                  container.classList.add('center');
                  container.classList.remove('right');
                  container.classList.remove('left');
                }
              } else {
                if (marginRight < 0) {
                  if (isCenter && marginLeft > width / 2) {
                    container.classList.add('left');
                    container.classList.remove('center');
                    container.classList.remove('right');
                  }
                } else {
                  container.classList.add('center');
                  container.classList.remove('left');
                  container.classList.remove('right');
                }
              }
            }
          }
        });
    }

    computeDayLabel(day: string): TemplateResult {
        return html`
            <div class="day  ${this._show_short_days ? 'short':''}">
                ${
                    this._show_short_days ? days_short[days.indexOf(day)] : day
                }
            </div>
        `;
    }

    computeSetpointLabel(setPoint) {
        if (setPoint == 'Unknown') return setPoint;
        if (this.schedule_type == 'Heating' && setPoint == -20) { return 'Off' }
        return setPoint + SetpointUnits[this.schedule_type!];
    }

    static get styles(): CSSResultGroup {
        return css`
            :host {
            display: block;
            max-width: 100%;
            }
            div.outer {
            width: 100%;
            overflow: visible;
            }
            div.wrapper,
            div.time-wrapper {
            white-space: nowrap;
            transition: width 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67),
                margin 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67);
            display: flex;
            }
            div.sub-section {
                display: flex;
                justify-content: center;
                width: 100%;
            }
            .special-times {
                justify-content: flex-end;
                line-height: 40px;
                padding: 0 5px;
                text-transform: uppercase;
                font-size: small;
            }
            .section-header {
                color: var(--material-body-text-color, #000);
                text-transform: uppercase;
                font-weight: 500;
                font-size: var(--material-small-font-size);
                padding: 5px 10px;
            }
            .slot {
                float: left;
                background: rgba(var(--rgb-primary-color), 0.7);
                height: 60px;
                box-sizing: border-box;
                transition: background 0.1s cubic-bezier(0.17, 0.67, 0.83, 0.67);
                position: relative;
                height: 40px;
                line-height: 40px;
                font-size: 10px;
                text-align: center;
            }
            .slot:first-child {
                border-radius: 5px 0 0 5px;
            }
            .slot:last-child {
                border-radius: 0 5px 5px 0;
            }
            .slot:only-child {
                border-radius: 5px;
            }
            .slot.previous {
            cursor: default;
            }
            .slot.selected {
            background: rgba(52,143,255,1)
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
            }
            div.slot.selectable {
                cursor: pointer;
            }

            .previous {
            display: block;
            background: repeating-linear-gradient(135deg, rgba(0,0,0,0), rgba(0,0,0,0) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px);
            border-radius: 5px 0 0 5px;
            }
            .previous.selected {
                border: 2px solid var(--primary-color);
            }
            .previous.selected.theme-colors {
                border: 2px solid var(--warning-color)
            }
            .wrapper.selectable .slot:hover {
            background: rgba(var(--rgb-primary-color), 0.85);
            }
            .slot:not(:first-child) {
            border-left: 1px solid var(--card-background-color);
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
            .wrapper .day.short {
                max-width: 50px;
            }
            .wrapper .day {
                line-height: 42px;
                float: left;
                width: 20%;
                max-width: 100px;
            }
            .wrapper .schedule {
                position: relative;
                width: 100%;
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
            z-index: 5;
            }
            div.tooltip-container {
                position: absolute;
                margin-top: -12px;
                margin-left: -22px;
                width: 40px;
                height: 0px;
                text-align: center;
                line-height: 35px;
                z-index: 3;
                top: -26px;
            }

        div.tooltip-container.visible {
            display: block;
        }
        div.tooltip-container.left {
            margin-left: -80px;
            text-align: right;
        }
        div.tooltip-container.right {
            margin-left: 0px;
            text-align: left;
        }
        div.tooltip {
            display: inline-flex;
            margin: 0px auto;
            border-radius: 5px;
            color: var(--text-primary-color);
            font-size: 1em;
            padding: 0px 5px;
            text-align: center;
            line-height: 20px;
            z-index: 5;
            transition: all 0.1s ease-in;
            transform-origin: center bottom;
            --tooltip-color: var(--primary-color);
            background: var(--primary-color);
        }
      div.tooltip.active {
        --tooltip-color: rgba(var(--rgb-accent-color), 0.7);
      }
      div.tooltip-container.left div.tooltip {
        transform-origin: right bottom;
      }
      div.tooltip-container.right div.tooltip {
        transform-origin: left bottom;
      }
      div.tooltip-container.center div.tooltip:before {
        content: ' ';
        width: 0px;
        height: 0px;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 10px solid var(--primary-color);
        position: absolute;
        margin-top: 25px;
        margin-left: calc(50% - 6px);
        top: 0px;
        left: 0px;
      }
      div.tooltip-container.left div.tooltip:before {
        content: ' ';
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-right: 8px solid var(--tooltip-color);
        opacity: 1;
        position: absolute;
        margin-top: 15px;
        margin-left: calc(100% - 8px);
        left: 0px;
        top: 0px;
        width: 0px;
        height: 0px;
      }
      div.tooltip-container.right div.tooltip:before {
        content: ' ';
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
        border-left: 8px solid var(--tooltip-color);
        opacity: 1;
        position: absolute;
        margin-top: 15px;
        margin-left: 0px;
        left: 0px;
        top: 0px;
        width: 0px;
        height: 0px;
      }
        div.tooltip ha-icon {
            --mdc-icon-size: 18px;
        }

        mwc-button.state-button {
			padding: 0px 18px;
			margin: 0 2px;
			max-width: 100px;
        }
        mwc-button#state-on {
            background-color: var(--state-on-color);
        }
        mwc-button#state-off {
            background-color: var(--state-off-color);
        }

          mwc-button.warning
          {
            --mdc-theme-primary: var(--error-color);
          }
          mwc-button.warning .mdc-button .mdc-button__label {
            color: var(--primary-text-color)
          }
          mwc-button.right {
            float: right;
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
            margin-right: 2px;
          }
          mwc-button.active {
            background: var(--primary-color);
            --mdc-theme-primary: var(--text-primary-color);
            border-radius: 4px;
          }
          ha-icon-button.set-off-button {
            margin-left: 0px;
          }
          .sub-heading {
            padding-bottom: 10px;
            font-weight: 500;
          }
        `;
      }




}

