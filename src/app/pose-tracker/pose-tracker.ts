import { AfterViewInit, ElementRef, ViewChild, Component } from '@angular/core';
import { NormalizedLandmark } from '@mediapipe/drawing_utils';
import { Application, Sprite, Graphics, Assets } from 'pixi.js';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';


interface Point2D {
  x: number;
  y: number;
}

@Component({
  selector: 'app-pose-tracker',
  imports: [],
  templateUrl: './pose-tracker.html',
  styleUrls: ['./pose-tracker.css'],
})

export class PoseTracker implements AfterViewInit {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;

  private app!: Application;
  private stream?: MediaStream;
  private poseLandmarker!: PoseLandmarker;
  private sprite!: Sprite;
  private graphics!: Graphics;
  private video!: HTMLVideoElement;
  private lastVideoTime: number = -1;

  // Define persistent base join tracking points
  joints = {
    head: { x: 0, y: 0 },   neck: { x: 0, y: 0 },
    spine: { x: 0, y: 0 },  pelvis: { x: 0, y: 0 },
    lShoulder: { x: 0, y: 0 }, rShoulder: { x: 0, y: 0 },
    lElbow: { x: 0, y: 0 },    rElbow: { x: 0, y: 0 },
    lWrist: { x: 0, y: 0 },    rWrist: { x: 0, y: 0 },
    lHip: { x: 0, y: 0 },      rHip: { x: 0, y: 0 },
    lKnee: { x: 0, y: 0 },     rKnee: { x: 0, y: 0 },
    lAnkle: { x: 0, y: 0 },    rAnkle: { x: 0, y: 0 }
  };

  async ngAfterViewInit(): Promise<void> {
    await this.initPixi();
    await this.initializeCamera();
    await this.initializePoseLandmarker();
    this.poseLandmarker = this.getInstance();
    this.startDetection();
  }


  // initialize PIXI application
  private async initPixi(): Promise<void> {
    this.video = this.videoRef.nativeElement;
    this.app = new Application();

    await this.app.init({
      resizeTo: window,
      backgroundAlpha: 0,
      // width: 800,
      // height: 800
    })
    // PIXI texture
    // const texture = Texture.from(video);
    this.sprite = Sprite.from(this.video);
    this.graphics = new Graphics();
    this.sprite.width = this.app.screen.width;
    this.sprite.height = this.app.screen.height;
    this.sprite.texture = await Assets.load("../../assets/robot.png");
    this.sprite.texture.source.addressMode = 'repeat';
    // this.app.stage.addChild(this.sprite);
    this.app.stage.addChild(this.graphics);

    
    // position canvas in center of page
    this.app.canvas.style.position = 'absolute';
    this.app.canvas.style.top = '50%';
    this.app.canvas.style.left = '50%';
    this.app.canvas.style.transform = 'translate(-50%, -50%)';


    // Append PIXI canvas to the DOM
    document.body.appendChild(this.app.canvas);
  }

  // render camera
  private async initializeCamera(): Promise<void> {

    this.video = this.videoRef.nativeElement;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: true
    });

    this.video.srcObject = this.stream;

    await this.video.play();
  }

  // render pose tracker for PIXIJS video element
  async initializePoseLandmarker(): Promise<void> {
      
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
    );

    // access tflite file
    this.poseLandmarker =
      await PoseLandmarker.createFromModelPath(
        vision,
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" // Can be a local or remote path to a .task / .tflite bundle
      );
      // set running mode to VIDEO
      this.poseLandmarker.setOptions({
        runningMode: 'VIDEO',
      })
  }

  getInstance(): PoseLandmarker {
    return this.poseLandmarker;
  }


  // attempt to track poses
  private startDetection(): void {
    this.app.ticker.add(() => {
      if (this.video.currentTime === this.lastVideoTime) return;
      
      const results = this.poseLandmarker.detectForVideo(this.video, performance.now());
      this.lastVideoTime = this.video.currentTime;

      if (!results || !results.landmarks || results.landmarks.length === 0) return;
      
      const landmark = results.landmarks[0]; // Extract first tracked body

      this.drawSkeleton(landmark); // Draw the skeleton based on the current joint positions
    });
  }

  // Step B: Mirror and translate coordinate structures safely
  private getRawCoords = (landmark: NormalizedLandmark[], index: number): Point2D => ({
    x: landmark[index].x * this.app.screen.width,
    y: landmark[index].y * this.app.screen.height
  });

  // 3. Render loop (Call this whenever new tracking data arrives)
  private drawSkeleton(landmark: NormalizedLandmark[]): void {
      this.graphics.clear();
      
      // Define landmarks
    const nose = this.getRawCoords(landmark, 0);
    const lShoulder = this.getRawCoords(landmark, 11); const rShoulder = this.getRawCoords(landmark, 12);
    const lElbow = this.getRawCoords(landmark, 13);    const rElbow = this.getRawCoords(landmark, 14);
    const lWrist = this.getRawCoords(landmark, 15);    const rWrist = this.getRawCoords(landmark, 16);
    const lHip = this.getRawCoords(landmark, 23);      const rHip = this.getRawCoords(landmark, 24);
    const lKnee = this.getRawCoords(landmark, 25);     const rKnee = this.getRawCoords(landmark, 26);
    const lAnkle = this.getRawCoords(landmark, 27);    const rAnkle = this.getRawCoords(landmark, 28);
    const neck = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const pelvis = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
      
      // --- SEGMENT 1: Torso / Core (Very Thick) ---
    this.graphics.moveTo(neck.x, neck.y).lineTo(pelvis.x, pelvis.y);
    this.graphics.stroke({ width: 90, color: 'red', cap: 'round', join: 'round' });

    // --- SEGMENT 2: Upper Legs (Thick) ---
    this.graphics.moveTo(lHip.x, lHip.y).lineTo(lKnee.x, lKnee.y);
    this.graphics.moveTo(rHip.x, rHip.y).lineTo(rKnee.x, rKnee.y);
    this.graphics.stroke({ width: 70, color: 'red', cap: 'round', join: 'round' });

    // --- SEGMENT 3: Lower Legs & Upper Arms (Medium) ---
    this.graphics.moveTo(lKnee.x, lKnee.y).lineTo(lAnkle.x, lAnkle.y);
    this.graphics.moveTo(rKnee.x, rKnee.y).lineTo(rAnkle.x, rAnkle.y);
    this.graphics.moveTo(lShoulder.x, lShoulder.y).lineTo(lElbow.x, lElbow.y);
    this.graphics.moveTo(rShoulder.x, rShoulder.y).lineTo(rElbow.x, rElbow.y);
    this.graphics.stroke({ width: 50, color: 'red', cap: 'round', join: 'round' });

    // --- SEGMENT 4: Forearms (Thinner) ---
    this.graphics.moveTo(lElbow.x, lElbow.y).lineTo(lWrist.x, lWrist.y);
    this.graphics.moveTo(rElbow.x, rElbow.y).lineTo(rWrist.x, rWrist.y);
    this.graphics.stroke({ width: 35, color: 'red', cap: 'round', join: 'round' });
    
    // --- SEGMENT 5: Head ---
    this.graphics.moveTo(neck.x, neck.y).lineTo(nose.x, nose.y);
    this.graphics.stroke({ 
      width: 80, 
      // texture: this.sprite.texture 
      color: 'red',
      cap: 'round' 
    });
  }
}
