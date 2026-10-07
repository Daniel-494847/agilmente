import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ActividadResumen } from '../../../core/models/actividad.model';

/** Mapa colorTema → clases Bootstrap */
const TEMA_CLASES: Record<ActividadResumen['colorTema'], string> = {
  purple: 'bg-primary-subtle border-primary-subtle text-primary',
  green: 'bg-success-subtle border-success-subtle text-success',
  amber: 'bg-warning-subtle border-warning-subtle text-warning',
  blue: 'bg-info-subtle border-info-subtle text-info',
  pink: 'bg-danger-subtle border-danger-subtle text-danger',
  orange: 'bg-warning-subtle border-warning-subtle text-warning-emphasis'
};

const TEMA_BTN: Record<ActividadResumen['colorTema'], string> = {
  purple: 'btn-primary',
  green: 'btn-success',
  amber: 'btn-warning',
  blue: 'btn-info',
  pink: 'btn-danger',
  orange: 'btn-warning'
};

@Component({
  selector: 'app-activity-card',
  imports: [RouterLink],
  templateUrl: './activity-card.html'
})
export class ActivityCard {
  @Input({ required: true }) actividad!: ActividadResumen;
  @Input({ required: true }) numero!: number;

  clasesTema(): string {
    return TEMA_CLASES[this.actividad.colorTema] ?? TEMA_CLASES.blue;
  }

  claseBoton(): string {
    return TEMA_BTN[this.actividad.colorTema] ?? 'btn-primary';
  }
}
