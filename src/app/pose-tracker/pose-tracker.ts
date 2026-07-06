import { AfterViewInit, OnInit, ElementRef, ViewChild, Component } from '@angular/core';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, NormalizedLandmark, drawLandmarks } from '@mediapipe/drawing_utils';
import { Application, Sprite, Texture, Graphics, Assets, MeshGeometry, Mesh, MeshPlane } from 'pixi.js';
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
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private app!: Application;
  private stream?: MediaStream;
  private poseLandmarker!: PoseLandmarker;
  private sprite!: Sprite;
  private graphics!: Graphics;
  private video!: HTMLVideoElement;
  private texture!: Texture;
  private lastVideoTime: number = -1;
  private bodyPlane!: MeshPlane;
  // Define persistent tracking states for your 5 landmarks
  private smoothedPoints = {
    nose: { x: 0, y: 0 },
    leftWrist: { x: 0, y: 0 },
    rightWrist: { x: 0, y: 0 },
    leftAnkle: { x: 0, y: 0 },
    rightAnkle: { x: 0, y: 0 }
  };

  private isFirstFrame = true;

  // 2. CONFIGURATION VALUES
  private readonly MIN_SENSITIVITY = 0.12; 
  private readonly MAX_SENSITIVITY = 0.70; 
  private readonly SPEED_THRESHOLD = 40;   
  private readonly DEAD_ZONE = 1.2;        
  
  private readonly MAX_ARM_STRETCH = 180;  
  private readonly MAX_LEG_STRETCH = 220;  






  async ngAfterViewInit(): Promise<void> {
    await this.initPixi();
    await this.initializeCamera();
    // this.bodyPlane.pivot.set(this.bodyPlane.width / 2, this.bodyPlane.height / 2);
    this.bodyPlane.x = 0;
    this.bodyPlane.y = 0;
    // this.initializeWebcamSprite();
    await this.initializePoseLandmarker();
    this.poseLandmarker = this.getInstance();
    this.startDetection();
  }

  private async onResults(results: any, canvas: HTMLCanvasElement) {
    const ctx = this.ctx;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw camera frame
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS);
      drawLandmarks(ctx, results.poseLandmarks, { radius: 3 });
    }

    ctx.restore();
  }

  // initialize PIXI application
  private async initPixi(): Promise<void> {
    this.video = this.videoRef.nativeElement;
    this.app = new Application();

    await this.app.init({
      width: 640,
      height: 480,
    })
    // PIXI texture
    // const texture = Texture.from(video);
    this.sprite = Sprite.from(this.video);
    this.graphics = new Graphics();
    this.sprite.width = this.app.screen.width;
    this.sprite.height = this.app.screen.height;
    this.sprite.texture = await Assets.load("../../assets/robot.png");
    // this.app.stage.addChild(this.sprite);
    // this.app.stage.addChild(this.graphics);

    
    // position canvas in center of page
    this.app.canvas.style.position = 'absolute';
    this.app.canvas.style.top = '50%';
    this.app.canvas.style.left = '50%';
    this.app.canvas.style.transform = 'translate(-50%, -50%)';



    this.bodyPlane = new MeshPlane({
      texture: this.sprite.texture,
      width: this.app.screen.width,
      height: this.app.screen.height,
      verticesX: 3,
      verticesY: 3
    });
    this.app.stage.addChild(this.bodyPlane);


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

   // A simple Lerp function
  lerp(start: number, end: number, amt: number): number {
    return (1 - amt) * start + amt * end;
  }

  // attempt to track poses
  private startDetection(): void {

  this.app.ticker.add(() => {
    // if (this.video.currentTime !== this.lastVideoTime) {
    //     // Process webcam frame
    //     const results = this.poseLandmarker.detectForVideo(this.videoRef.nativeElement, performance.now());
    //     this.lastVideoTime = this.video.currentTime;

    //     if (results.landmarks && results.landmarks.length > 0) {
    //       // Get landmark 8 (Index Finger Tip)
    //       const indexFinger = results.landmarks[0][8];

    //       // Convert normalized MediaPipe coords to PixiJS stage coordinates
    //       const targetX = indexFinger.x * this.app.screen.width;
    //       const targetY = indexFinger.y * this.app.screen.height;

    //       // Move the sprite to match hand position
    //       this.sprite.x = targetX;
    //       this.sprite.y = targetY;
    //     }
    // }
  //   if (this.video.currentTime !== this.lastVideoTime) {
  //   const results = this.poseLandmarker.detectForVideo(this.video, performance.now());
  //   this.lastVideoTime = this.video.currentTime;

  //   if (results.landmarks && results.landmarks.length > 0) {
  //     const landmarks = results.landmarks[0]; // Extract first tracked body

  //     // Access MeshPlane's internal flat positions array
  //     // Structure of points: 
  //     // [v0_x, v0_y,  v1_x, v1_y,  v2_x, v2_y] -> Row 0 (Top)
  //     // [v3_x, v3_y,  v4_x, v4_y,  v5_x, v5_y] -> Row 1 (Middle)
  //     // [v6_x, v6_y,  v7_x, v7_y,  v8_x, v8_y] -> Row 2 (Bottom)
  //     const v = this.bodyPlane.geometry.getBuffer('aPosition').data as Float32Array;
     

      

  //     // --- Map Coordinates Without Tearing Gaps ---

  //     // Helper function to process mirrored coordinates safely
  //     const getCoords = (lm: NormalizedLandmark) => ({
  //       x: this.app.screen.width - (lm.x * this.app.screen.width), // Mirror correction
  //       y: lm.y * this.app.screen.height
  //     });

  //     const nose = getCoords(landmarks[0]);
  //     const leftWrist = getCoords(landmarks[15]);
  //     const rightWrist = getCoords(landmarks[16]);
  //     const leftAnkle = getCoords(landmarks[27]);
  //     const rightAnkle = getCoords(landmarks[28]);

  //      // 2. DYNAMICALLY COMPUTE BOUNDS (Keeps the sprite wrapped to the body)
  //     const minX = Math.min(leftWrist.x, rightWrist.x, leftAnkle.x, rightAnkle.x) - 50; // padding
  //     const maxX = Math.max(leftWrist.x, rightWrist.x, leftAnkle.x, rightAnkle.x) + 50;
  //     const minY = nose.y - 100; // room for the head

  //     // In your PixiJS update loop:
  //     const smoothingFactor = 0.2; // Lower = slower/smoother, Higher = faster/more responsive
  //     this.bodyPlane.x = this.lerp(this.bodyPlane.x, minX, smoothingFactor);
  //     this.bodyPlane.y = this.lerp(this.bodyPlane.y, minY, smoothingFactor);



  //     // 3. Map to the 3x3 Grid Sequentially
  //     // Row 0: Top Edges (Now bound-constrained instead of screen-locked)
  //     v[0] = minX;            v[1] = minY;            // Dynamic Top-Left Bound
  //     v[2] = nose.x;          v[3] = nose.y;          // Dynamic Head tracking
  //     v[4] = maxX;            v[5] = minY;            // Dynamic Top-Right Bound

  //     // Row 1: Middle Posture Matrix
  //     v[6] = leftWrist.x;     v[7] = leftWrist.y;     // Left Arm
  //     v[8] = (leftWrist.x + rightWrist.x) / 2;        // Core Center
  //     v[9] = (leftWrist.y + rightWrist.y) / 2;
  //     v[10] = rightWrist.x;   v[11] = rightWrist.y;   // Right Arm

  //     // Row 2: Base Anchors
  //     v[12] = leftAnkle.x;    v[13] = leftAnkle.y;    // Left Leg
  //     v[14] = (leftAnkle.x + rightAnkle.x) / 2;       // Bottom Center
  //     v[15] = Math.max(leftAnkle.y, rightAnkle.y) + 20; 
  //     v[16] = rightAnkle.x;   v[17] = rightAnkle.y;   // Right Leg

  //     // CRITICAL V8 TRICK: Flag the specific attribute buffer as dirty so the GPU re-renders it
  //     this.bodyPlane.geometry.getBuffer('aPosition').update();
  //   }
  // }

    if (this.video.currentTime === this.lastVideoTime) return;
    
    const results = this.poseLandmarker.detectForVideo(this.video, performance.now());
    this.lastVideoTime = this.video.currentTime;

    if (!results || !results.landmarks || results.landmarks.length === 0) return;
    
    const landmarks = results.landmarks[0]; // Extract first tracked body

    // Step B: Mirror and translate coordinate structures safely
      const getRawCoords = (lm: any): Point2D => {
        if (!lm) return { x: this.app.screen.width / 2, y: this.app.screen.height / 2 };
        return {
          x: this.app.screen.width - (lm.x * this.app.screen.width), // Mirror correction mapping
          y: lm.y * this.app.screen.height
        };
      };

      // Extract raw target milestones directly using standard index arrays
      const targetNose       = getRawCoords(landmarks[0]);  // Index 0
      const targetLeftWrist  = getRawCoords(landmarks[15]); // Index 15
      const targetRightWrist = getRawCoords(landmarks[16]); // Index 16
      const targetLeftAnkle  = getRawCoords(landmarks[27]); // Index 27
      const targetRightAnkle = getRawCoords(landmarks[28]); // Index 28

      // Step C: Teleport vectors on instantiation frame to prevent starting at origin (0,0) jumps
      if (this.isFirstFrame) {
        this.smoothedPoints['nose']       = { ...targetNose };
        this.smoothedPoints['leftWrist']  = { ...targetLeftWrist };
        this.smoothedPoints['rightWrist'] = { ...targetRightWrist };
        this.smoothedPoints['leftAnkle']  = { ...targetLeftAnkle };
        this.smoothedPoints['rightAnkle'] = { ...targetRightAnkle };
        this.isFirstFrame = false;
      }

      // Step D: Velocity Adaptive Filter Algorithm
      const smoothPoint = (current: Point2D, target: Point2D): Point2D => {
        const deltaX = target.x - current.x;
        const deltaY = target.y - current.y;
        const distance = Math.hypot(deltaX, deltaY);

        if (distance > this.DEAD_ZONE) {
          const adaptiveFactor = Math.min(distance / this.SPEED_THRESHOLD, 1.0);
          const dynamicSensitivity = this.MIN_SENSITIVITY + (this.MAX_SENSITIVITY - this.MIN_SENSITIVITY) * adaptiveFactor;

          current.x += deltaX * dynamicSensitivity;
          current.y += deltaY * dynamicSensitivity;
        }
        return current;
      };


      // Step E: Target the correct, standard attribute buffer key name in PixiJS v8
      const v = this.bodyPlane.geometry.positions; // NOT 'aPosition'
      // In PixiJS v8, UV mapping arrays can be extracted directly from the attributes map
      const uvs = this.bodyPlane.geometry.uvs;
      if (!v || !uvs) return;

      // const v = positionBuffer.data as Float32Array;

      // Safe isolated inline mapping processor index utility
      const nose       = smoothPoint(this.smoothedPoints['nose'], targetNose);
      const leftWrist  = smoothPoint(this.smoothedPoints['leftWrist'], targetLeftWrist);
      const rightWrist = smoothPoint(this.smoothedPoints['rightWrist'], targetRightWrist);
      const leftAnkle  = smoothPoint(this.smoothedPoints['leftAnkle'], targetLeftAnkle);
      const rightAnkle = smoothPoint(this.smoothedPoints['rightAnkle'], targetRightAnkle);

      // Extract raw v8 arrays
      const positionsArray = this.bodyPlane.geometry.positions;
      const uvsArray       = this.bodyPlane.geometry.uvs;
      if (!positionsArray || !uvsArray) return;

      // Set up your clamping math
      const centerX = nose.x;
      const centerY = (leftWrist.y + rightWrist.y) / 2;
      const clampToRadius = (point: Point2D, maxDistance: number): Point2D => {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            const dist = Math.hypot(dx, dy);
            return dist > maxDistance ? { x: centerX + (dx / dist) * maxDistance, y: centerY + (dy / dist) * maxDistance } : point;
          };


      const constrainedLeftWrist  = clampToRadius(leftWrist, this.MAX_ARM_STRETCH);
      const constrainedRightWrist = clampToRadius(rightWrist, this.MAX_ARM_STRETCH);
      const constrainedLeftAnkle  = clampToRadius(leftAnkle, this.MAX_LEG_STRETCH);
      const constrainedRightAnkle = clampToRadius(rightAnkle, this.MAX_LEG_STRETCH);

      // Inline helper function for array mutating
      const setVertexAndUV = (vertexIndex: number, pixelX: number, pixelY: number) => {
        const baseIndex = vertexIndex * 2;
        if (baseIndex >= positionsArray.length) return;
        positionsArray[baseIndex]     = pixelX;
        positionsArray[baseIndex + 1] = pixelY;
        uvsArray[baseIndex]           = (pixelX - minBodyX) / (maxBodyX - minBodyX); // Dynamically scaled horizontally
        uvsArray[baseIndex + 1]       = (pixelY - minBodyY) / (maxBodyY - minBodyY); // Dynamically scaled vertically
      };

      // ==========================================
      // PLACE THE BOUNDS AND LAYOUT LOGIC HERE:
      // ==========================================

      // 1. Calculate the stable box boundary that strictly encapsulates your body stretch
      const minBodyX = Math.min(constrainedLeftWrist.x, constrainedRightWrist.x, constrainedLeftAnkle.x, constrainedRightAnkle.x) - 40;
      const maxBodyX = Math.max(constrainedLeftWrist.x, constrainedRightWrist.x, constrainedLeftAnkle.x, constrainedRightAnkle.x) + 40;
      const minBodyY = nose.y - 80;
      const maxBodyY = Math.max(constrainedLeftAnkle.y, constrainedRightAnkle.y) + 40;

      const midBodyY = (minBodyY + maxBodyY) / 2;

      // 2. Map coordinates safely to prevent edge-crossing inversions (Vertices 0 - 8)
      // ROW 0: TOP LAYER (Head boundary frame)
      setVertexAndUV(0, minBodyX, minBodyY);            
      setVertexAndUV(1, nose.x,   nose.y);              
      setVertexAndUV(2, maxBodyX, minBodyY);            

      // ROW 1: MIDDLE LAYER (Safe horizontal wrist track)
      setVertexAndUV(3, constrainedLeftWrist.x,  midBodyY);                 
      setVertexAndUV(4, centerX,                 centerY);                  
      setVertexAndUV(5, constrainedRightWrist.x, midBodyY);                 

      // ROW 2: BASE LAYER (Anchored ankle tracking)
      setVertexAndUV(6, minBodyX,                                constrainedLeftAnkle.y);         
      setVertexAndUV(7, (constrainedLeftAnkle.x + constrainedRightAnkle.x) / 2, maxBodyY);         
      setVertexAndUV(8, maxBodyX,                                constrainedRightAnkle.y);        

      // ==========================================
      // END OF PLACEMENT - NOW FLUSH TO THE GPU
      // ==========================================

      // 3. Re-assign the arrays back to their properties to trigger PixiJS v8 setter update flags
      this.bodyPlane.geometry.positions = positionsArray;
      this.bodyPlane.geometry.uvs       = uvsArray;

     
      
  });
}
}
