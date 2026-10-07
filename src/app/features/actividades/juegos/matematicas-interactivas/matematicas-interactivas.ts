import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-matematicas-interactivas',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './matematicas-interactivas.html',
  styleUrl: './matematicas-interactivas.css'
})
export class MatematicasInteractivas {}
