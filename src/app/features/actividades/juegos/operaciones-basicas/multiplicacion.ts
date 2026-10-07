import { Component } from '@angular/core';

import { DueloIndividualOp } from './duelo-individual/duelo-individual';

@Component({
  selector: 'app-operaciones-basicas-multiplicacion',
  standalone: true,
  imports: [DueloIndividualOp],
  template: `<app-duelo-individual-op
    tipo="multiplicacion"
    titulo="Multiplicación"
    rutaVolver="/razonamiento-logico/operaciones-basicas"
    textoVolver="Operaciones básicas"
  />`
})
export class OperacionesBasicasMultiplicacion {}
