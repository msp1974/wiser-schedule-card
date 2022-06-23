/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LitElement, html, css, TemplateResult, CSSResultGroup, PropertyValues } from 'lit';
import { property, customElement, state } from 'lit/decorators.js';
import { CurrentUser, fireEvent } from 'custom-card-helpers';
import type { WiserScheduleCardConfig, Schedule, WiserEventData, Room, Entities, ScheduleAssignments } from '../types';
import { allow_edit } from '../helpers';
import { fetchScheduleById, fetchRoomsList, fetchDeviceList, assignSchedule, deleteSchedule, saveSchedule } from '../data/websockets';
import { SubscribeMixin } from '../components/subscribe-mixin';
import { UnsubscribeFunc } from 'home-assistant-js-websocket';

import '../components/schedule-slot-editor'

@customElement('wiser-schedule-edit-card')
export class SchedulerEditCard extends SubscribeMixin(LitElement) {
    @property({ attribute: false }) public config!: WiserScheduleCardConfig;
    @property({ attribute: false }) public schedule_id?: number = 0
    @property({ attribute: false }) public schedule_type?: string
    @property({ attribute: false }) public use_heat_colors = true

    @state() schedule?: Schedule
    @state() rooms: Room[] = [];
    @state() entities: Entities[] = [];
    @state() component_loaded;
    @state() _activeSlot = null;
 	@state() _activeDay = null;
  	@state() editMode = false;
    @state() _current_user?: CurrentUser = this.hass?.user
    @state() _assigning_in_progress = 0;
    @state() _save_in_progress = false;

    _tempSchedule?: Schedule
    stepSize = 5;

    async initialise(): Promise<boolean> {
        if (await this._isComponentLoaded()) {
            this.component_loaded = true;
        }
        return true
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
        if (ev.event == 'wiser_updated') await this.loadData();
    }

    async _isComponentLoaded(): Promise<boolean> {
        while (!this.hass && !this.config && !this.hass!.config.components.includes("wiser")) {
        await new Promise(resolve => setTimeout(resolve, 100))
        }
        await this.loadData();
        return true
    }

    private async loadData() {
        if (this.schedule_type && this.schedule_id) {
            this.schedule = await fetchScheduleById(this.hass!, this.config!.hub, this.schedule_type!, this.schedule_id!);
            this.entities = await this.get_entity_list(this.hass!, this.config!.hub);
        }
    }

    private async get_entity_list(hass, hub): Promise<Entities[]> {
        if (this.schedule!.Type.toLowerCase() == 'heating') {
        	return await fetchRoomsList(hass, hub)
        }
        return await fetchDeviceList(hass, hub, this.schedule!.SubType)
    }

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        if (changedProps.has('schedule_id') || changedProps.has('editMode') ) {
            this.loadData();
            return true
        }
        if (changedProps.has('force')) { return true }
        if (changedProps.has('schedule') || changedProps.has('entities') || changedProps.has('editMode') || changedProps.has('_assigning_in_progress') || changedProps.has('_save_in_progress')) { return true }
        return false;
    }


	protected render(): TemplateResult {
		//<ha-icon-button .path=${mdiClose} @click=${this.backClick}> </ha-icon-button>
        if (!this.hass || !this.config || !this.component_loaded) return html``;
        if (this.schedule  && this.entities) {
			return html`
            <ha-card>
            <div class="card-header">
                <div class="name">
                ${this.config!.name}
                </div>
            </div>
            <div class="card-content">
                <div class="schedule-info">
                    <span class="sub-heading">Schedule Type:</span> ${this.schedule.SubType}
                </div>
                <div class="schedule-info">
                    <span class="sub-heading">Schedule Id:</span> ${this.schedule.Id}
                </div>
                <div class="schedule-info">
                    <span class="sub-heading">Schedule Name:</span> ${this.schedule.Name}
                </div>
				<div class=${this.editMode ? 'mode': ''}>
					${this.editMode ? 'Edit Mode': null}
				</div>
                <div class="wrapper">
                    <div class="schedules">
                        <div class = "slots-wrapper">
                            <wiser-schedule-slot-editor
                                .hass=${this.hass}
                                .config=${this.config}
                                .schedule=${this.editMode ? this._tempSchedule : this.schedule}
								.schedule_type=${this.schedule_type}
                                .editMode=${this.editMode}
								@scheduleChanged=${this.scheduleChanged}
                            ></wiser-schedule-slot-editor>
                        </div>
                    </div>
                </div>
				${this.entities.length ? this.renderScheduleAssignment(this.entities, this.schedule!.Assignments): '(No available devices)'}
				${this.renderScheduleActionButtonSection()}
            </div>
            ${this.renderCardActions()}
            </ha-card>
        `;
        }
        return html`
        <ha-card>
            <div class="card-header">
                <div class="name">
                ${this.config!.name}
                </div>
            </div>
            <div class="card-content">
            </div>
        </ha-card>`;
	}


    renderScheduleAssignment(entities: Entities[], schedule_entities: ScheduleAssignments[] | string[]): TemplateResult | void {
		if (this.schedule && !this.editMode) {
			if (allow_edit(this.hass!, this.config)) {
				return html`
					<div class="assignment-wrapper">
						<div class="sub-heading">Schedule Assignment</div>
						${entities.map(entity => this.renderEntityButton(entity, schedule_entities.map(function(a) {return a.name}).includes(entity.Name)))}
					</div>
				`;
			} else {
				return html`
					<div class="assignment-wrapper">
						<div class="sub-heading">Schedule Assignment</div>
						${schedule_entities.length > 0 ?
						entities.filter(entity => schedule_entities.map(function(a) {return a.name}).includes(entity.Name)).map(entity => this.renderEntityLabel(entity)) :
						html`<span class="assignment-label">(Not Assigned)</span>`
						}
					</div>
				`;
			}
		}
	}

    renderEntityButton(entity: Entities, active: boolean): TemplateResult | void {
		return html`
			<mwc-button id=${entity.Id}
			class=${active ? 'active':''}
			@click=${this.entityAssignmentClick}
			>
			${this._assigning_in_progress == entity.Id
                ? html`<span class="waiting"><ha-circular-progress active size="small"></ha-circular-progress></span>`
            : null}
            ${entity.Name}
			</mwc-button>
		`;
	}

	renderScheduleActionButtonSection(): TemplateResult | void {
		if (this.schedule && !this.editMode) {
			if (allow_edit(this.hass!, this.config)) {
				return html`
					<div class="actions-wrapper">
						<div class="sub-heading">Schedule Actions</div>
						<div class="wrapper schedule-action-wrapper">
							${this.renderEditScheduleButton()}
							${this.renderCopyScheduleButton()}
							${this.renderDeleteScheduleButton()}
						</div>
					</div>
				`;
			}
		}
	}

    renderEntityLabel(entity: Entities): TemplateResult | void {
      return html`
        <span class="assignment-label">
            ${entity.Name}
        </span>
        `;
	}



    renderCardActions(): TemplateResult | void {
        if (!this.config.selected_schedule || this.editMode) {
            return html`
                <div class="card-actions">
					<div class="action-buttons">
						${!this.editMode ? this.renderBackButton() : null}
						${this.editMode ? this.renderCancelButton(): null}
						${this.editMode ? this.renderSaveScheduleButton() : null}
					</div>
                </div>
            `;
        }
	}

	renderBackButton(): TemplateResult | void {
		return html`
			<mwc-button @click=${this.backClick}
			>Back
			</mwc-button>
		`;
    }

    renderCancelButton(): TemplateResult | void {
		return html`
			<mwc-button @click=${this.cancelClick}
			>Cancel
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
        `
    }

    renderCopyScheduleButton(): TemplateResult | void {
        return html`
        <mwc-button
            class="large active"
            label=${'Copy'}
            .disabled=${this.schedule_id == 1000}
            @click=${this.copyClick}
        >
        </mwc-button>
        `
    }

	renderEditScheduleButton(): TemplateResult | void {
		return html`
		<mwc-button
			class="large active"
			label=${'Edit'}
			@click=${this.editClick}
		>
		</mwc-button>
		`;
	}

	renderSaveScheduleButton(): TemplateResult | void {
        if (allow_edit(this.hass!, this.config)) {
            return html`
                <mwc-button class="right"
					@click=${this.saveClick}
                >
                ${this._save_in_progress
                    ? html`<ha-circular-progress active size="small"></ha-circular-progress>`
                    : 'Save'}
            </mwc-button>
            `;
        }
	}

	async entityAssignmentClick(ev: Event): Promise<void> {
        const e = ev.target as HTMLDivElement;
        this._assigning_in_progress = parseInt(e.id)
        if (allow_edit(this.hass!, this.config)) {
            await assignSchedule(this.hass!, this.config!.hub, this.schedule_type!, this.schedule_id!, e.id, e.classList.contains('active'));
        }
        this._assigning_in_progress = 0
    }

    backClick(): void {
        const myEvent = new CustomEvent('backClick');
        this.dispatchEvent(myEvent);
    }

    editClick(): void {
        this._tempSchedule = this.schedule
        this.editMode = !this.editMode;
    }

    copyClick(): void {
        const myEvent = new CustomEvent('copyClick');
        this.dispatchEvent(myEvent);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async deleteClick(ev): Promise<void> {
        const element = ev.target as HTMLElement;
        const result = await new Promise(resolve => {
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
            name: this.schedule!.Name
            },
        });
        });
        if (result) {
            this.schedule_id = 0;
            await deleteSchedule(this.hass!, this.config!.hub, this.schedule!.Type, this.schedule!.Id)
            const myEvent = new CustomEvent('scheduleDeleted');
            this.dispatchEvent(myEvent);
        }
	}

	cancelClick(): void {
		this.editMode = false;
	}

    async saveClick(): Promise<void> {
        this._save_in_progress = true;
        await saveSchedule(this.hass!, this.config.hub, this.schedule_type!, this.schedule_id!, this._tempSchedule!);
        this._save_in_progress = false;
        this.editMode = false;
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	scheduleChanged(ev): void {
		this._tempSchedule = ev.detail.schedule;
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
          transition: width 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67),
            margin 0.2s cubic-bezier(0.17, 0.67, 0.83, 0.67);
        }
        div.assignment-wrapper, div.actions-wrapper {
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
          cursor: pointer;
        }
        .previous {
          display: block;
          background: repeating-linear-gradient(135deg, rgba(0,0,0,0), rgba(0,0,0,0) 5px, rgba(255,255,255,0.2) 5px, rgba(255,255,255,0.2) 10px);
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
        .slots-wrapper {
              padding-bottom: 20px;
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
        mwc-button.warning
        {
          --mdc-theme-primary: #fff;
		  background-color: var(--error-color);
		  border-radius: var(--mdc-shape-small, 4px)
        }
		mwc-button.large {
			width: 20%;
			padding: 0px 18px;
			margin: 0 2px;
			max-width: 200px;
		}
		mwc-button.right {
            float: right;
          }
        mwc-button.warning .mdc-button .mdc-button__label {
          color: var(--primary-text-color)
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