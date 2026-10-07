import { Component } from '@angular/core';

import { DueloIndividualOp } from './duelo-individual/duelo-individual';

@Component({
  selector: 'app-operaciones-basicas-combinadas',
  standalone: true,
  imports: [DueloIndividualOp],
  template: `<app-duelo-individual-op
    tipo="combinadas"
    titulo="Operaciones combinadas"
    rutaVolver="/razonamiento-logico/operaciones-basicas"
    textoVolver="Operaciones básicas"
  />`
})
export class OperacionesBasicasCombinadas {}
