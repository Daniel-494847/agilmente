import { Component } from '@angular/core';

import { DueloIndividualOp } from './duelo-individual/duelo-individual';

@Component({
  selector: 'app-operaciones-basicas-sumas',
  standalone: true,
  imports: [DueloIndividualOp],
  template: `<app-duelo-individual-op
    tipo="sumas"
    titulo="Sumas"
    rutaVolver="/razonamiento-logico/operaciones-basicas"
    textoVolver="Operaciones básicas"
  />`
})
export class OperacionesBasicasSumas {}
