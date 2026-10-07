import { Component } from '@angular/core';

import { DueloIndividualOp } from './duelo-individual/duelo-individual';

@Component({
  selector: 'app-operaciones-basicas-division',
  standalone: true,
  imports: [DueloIndividualOp],
  template: `<app-duelo-individual-op
    tipo="division"
    titulo="División"
    rutaVolver="/razonamiento-logico/operaciones-basicas"
    textoVolver="Operaciones básicas"
  />`
})
export class OperacionesBasicasDivision {}
