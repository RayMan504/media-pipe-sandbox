import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PoseTracker } from './pose-tracker/pose-tracker';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PoseTracker],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('media-pipe-sandbox');
}
