import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

interface PostureState {
  status: 'good' | 'bad';
  suggestion: string;
  score: number;
  badCount: number;
  sittingTime: string; // HH:MM:SS format
  showBreakAlert: boolean;
  cameraError: string | null;
  cameraReady: boolean;
  isLoading: boolean;
}

export function PostureTab() {
  const [state, setState] = useState<PostureState>({
    status: 'good',
    suggestion: 'Keep your feet flat on the floor and screen at eye level.',
    score: 100,
    badCount: 0,
    sittingTime: '00:00:00',
    showBreakAlert: false,
    cameraError: null,
    cameraReady: false,
    isLoading: true, // Start with loading state
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);
  const sittingStartRef = useRef<number>(Date.now());
  const lastPostureCheckRef = useRef<number>(0);

  // Initialize TensorFlow.js and pose detection model
  useEffect(() => {
    async function initializeCamera() {
      // Wait for video element to be rendered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!videoRef.current) {
        console.error('Video element not found');
        setState(prev => ({
          ...prev,
          cameraError: 'Video element not found. Please refresh the page.',
          isLoading: false
        }));
        return;
      }

      try {
        console.log('Requesting webcam access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        console.log('Webcam access granted');
        
        videoRef.current.srcObject = stream;
        
        await videoRef.current.play();
        console.log('Video playback started');
        
        // Load pose detection model after camera is ready
        const model = poseDetection.SupportedModels.MoveNet;
        detectorRef.current = await poseDetection.createDetector(
          model,
          {
            runtime: 'tfjs',
            modelType: 'lightning',
            enableSmoothing: true,
          } as any
        );
        console.log('Pose detection model loaded');
        
        setState(prev => ({
          ...prev,
          cameraError: null,
          cameraReady: true,
          isLoading: false
        }));
        
        // Start posture detection loop
        detectPosture();
      } catch (error) {
        console.error('Error initializing:', error);
        setState(prev => ({
          ...prev,
          cameraError: error instanceof Error ? error.message : String(error),
          cameraReady: false,
          isLoading: false
        }));
      }
    }

    initializeCamera();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      if (detectorRef.current) {
        (detectorRef.current as any).dispose();
      }
    };
  }, []);

  // Calculate angle between three points
  const calculateAngle = (a: any, b: any, c: any): number => {
    const [ax, ay] = [a.x, a.y];
    const [bx, by] = [b.x, b.y];
    const [cx, cy] = [c.x, c.y];
    
    const radians = Math.atan2(cy - by, cx - bx) - Math.atan2(ay - by, ax - bx);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    
    return angle;
  };

  // Analyze posture based on keypoints
  const analyzePosture = (keypoints: any[]): { status: 'good' | 'bad'; suggestion: string } => {
    if (!keypoints || keypoints.length < 17) {
      return { status: 'bad', suggestion: 'Please ensure your full upper body is visible in the camera.' };
    }

    // Get key points (using MoveNet keypoint indices)
    const nose = keypoints[0];
    const leftEye = keypoints[1];
    const rightEye = keypoints[2];
    const leftEar = keypoints[3];
    const rightEar = keypoints[4];
    const leftShoulder = keypoints[5];
    const rightShoulder = keypoints[6];
    const leftElbow = keypoints[7];
    const rightElbow = keypoints[8];
    const leftWrist = keypoints[9];
    const rightWrist = keypoints[10];
    const leftHip = keypoints[11];
    const rightHip = keypoints[12];
    const leftKnee = keypoints[13];
    const rightKnee = keypoints[14];
    const leftAnkle = keypoints[15];
    const rightAnkle = keypoints[16];

    // Only proceed if we have sufficient confidence
    const minConfidence = 0.3;
    if (
      leftShoulder.score < minConfidence ||
      rightShoulder.score < minConfidence ||
      leftEar.score < minConfidence ||
      rightEar.score < minConfidence ||
      leftHip.score < minConfidence ||
      rightHip.score < minConfidence ||
      nose.score < minConfidence
    ) {
      return { status: 'bad', suggestion: 'Please adjust your position for better detection.' };
    }

    // Calculate key angles for posture assessment
    // 1. Head tilt vs shoulders (ear-shoulder alignment)
    const leftEarShoulderAngle = calculateAngle(leftEar, leftShoulder, { x: leftShoulder.x, y: leftShoulder.y - 50 });
    const rightEarShoulderAngle = calculateAngle(rightEar, rightShoulder, { x: rightShoulder.x, y: rightShoulder.y - 50 });
    const earShoulderAlignment = Math.abs(leftEarShoulderAngle - rightEarShoulderAngle);
    
    // 2. Shoulder level (shoulder slope)
    const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);
    
    // 3. Spine angle (hip-to-shoulder vertical offset)
    const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const midHipY = (leftHip.y + rightHip.y) / 2;
    const spineAngle = Math.atan2(midShoulderY - midHipY, (leftShoulder.x + rightShoulder.x)/2 - (leftHip.x + rightHip.x)/2) * 180 / Math.PI;
    
    // 4. Ear-Shoulder-Hip angle
    const leftEarShoulderHip = calculateAngle(leftEar, leftShoulder, leftHip);
    const rightEarShoulderHip = calculateAngle(rightEar, rightShoulder, rightHip);
    const earShoulderHipAngle = (leftEarShoulderHip + rightEarShoulderHip) / 2;

    // Posture rules engine (based on README_Version2.md)
    let isGoodPosture = true;
    let suggestion = '';

    // Head vs. Shoulder alignment
    if (earShoulderAlignment > 10) { // Head tilted forward/side
      isGoodPosture = false;
      suggestion = 'Align your head directly above your shoulders.';
    }
    // Shoulder level
    else if (shoulderSlope > 20) { // One shoulder higher
      isGoodPosture = false;
      suggestion = 'Level your shoulders and avoid leaning to one side.';
    }
    // Spine angle
    else if (Math.abs(spineAngle) > 15) { // > 10° lean (allowing some tolerance)
      isGoodPosture = false;
      suggestion = 'Sit up straight with your back against the chair.';
    }
    // Ear-Shoulder-Hip angle
    else if (earShoulderHipAngle < 150) { // < 150°
      isGoodPosture = false;
      suggestion = 'Keep your feet flat on the floor and screen at eye level.';
    }

    return {
      status: isGoodPosture ? 'good' : 'bad',
      suggestion: suggestion || 'Keep your feet flat on the floor and screen at eye level.',
    };
  };

  // Update sitting time
  const updateSittingTime = () => {
    const elapsedSeconds = Math.floor((Date.now() - sittingStartRef.current) / 1000);
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    
    const formattedTime = 
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    setState(prev => ({
      ...prev,
      sittingTime: formattedTime,
      showBreakAlert: elapsedSeconds > 600 // 10 minutes
    }));
  };

  // Main posture detection loop
  const detectPosture = async () => {
    if (!videoRef.current || !detectorRef.current) {
      animationFrameRef.current = requestAnimationFrame(detectPosture);
      return;
    }

    try {
      // Detect poses
      const poses = await detectorRef.current.estimatePoses(videoRef.current!, {
        maxPoses: 1,
        flipHorizontal: false,
      });

      if (poses.length > 0) {
        const keypoints = poses[0].keypoints;
        const { status, suggestion } = analyzePosture(keypoints);
        
        // Update state based on posture analysis
        setState(prev => {
          let newScore = prev.score;
          let newBadCount = prev.badCount;
          
          if (status === 'bad') {
            // Decrease score when bad posture detected (but not below 0)
            newScore = Math.max(0, prev.score - 1);
            // Increment bad posture count (with debounce to avoid multiple counts per second)
            if (Date.now() - lastPostureCheckRef.current > 1000) { // At most once per second
              newBadCount = prev.badCount + 1;
              lastPostureCheckRef.current = Date.now();
            }
          } else {
            // Gradually recover score when good posture (but not above 100)
            newScore = Math.min(100, prev.score + 0.5);
          }
          
          return {
            ...prev,
            status,
            suggestion,
            score: Math.round(newScore),
            badCount: newBadCount,
          };
        });
      }
    } catch (error) {
      console.error('Error during pose detection:', error);
    }

    // Continue detection loop
    animationFrameRef.current = requestAnimationFrame(detectPosture);
  };

  // Start sitting time tracker
  useEffect(() => {
    const timer = setInterval(updateSittingTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle break alert dismissal
  const handleBreakAlertDismiss = () => {
    setState(prev => ({
      ...prev,
      showBreakAlert: false,
    }));
    // Reset sitting timer when user takes a break
    sittingStartRef.current = Date.now();
  };

  return (
    <div className="tab-panel posture-panel">
      <div className="posture-container">
        <div className="posture-header">
          <h2>🧍 AI Posture Guard</h2>
        </div>
        
        <div className="posture-content">
          {/* Loading State */}
          {state.isLoading && !state.cameraError && !state.cameraReady && (
            <div className="camera-loading">
              <p>📹 Initializing camera...</p>
              <p>Please grant camera access when prompted by your browser</p>
            </div>
          )}
          
          {/* Camera Error Display */}
          {state.cameraError && (
            <div className="camera-error">
              <p>❌ Camera Error: {state.cameraError}</p>
              <p>Please check:</p>
              <ul>
                <li>Camera is connected and not being used by another application</li>
                <li>You granted camera access when prompted</li>
                <li>You're running the app on localhost or HTTPS</li>
              </ul>
              <button className="btn" onClick={() => setState(prev => ({...prev, cameraError: null, isLoading: true}))}>
                Try Again
              </button>
            </div>
          )}
          
          {/* Camera Feed - always render but hide until ready */}
          <div className={`camera-container ${!state.cameraReady ? 'camera-hidden' : ''}`}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="camera-feed"
            />
            {!state.cameraReady && !state.cameraError && (
              <div className="camera-placeholder">
                <p>📹 Camera initializing...</p>
              </div>
            )}
          </div>
          
          {/* Status Panel */}
          <div className="status-panel">
            <div className="status-item">
              <span className="status-label">Status:</span>
              <span className={`status-value ${state.status}`}>
                {state.status === 'good' ? '✅ Good Posture' : '❌ Bad Posture'}
              </span>
            </div>
            
            <div className="status-item">
              <span className="status-label">Suggestion:</span>
              <span className="status-value suggestion">{state.suggestion}</span>
            </div>
            
            <div className="status-item">
              <span className="status-label">Posture Score:</span>
              <span className="status-value score">{state.score}/100</span>
            </div>
            
            <div className="status-item">
              <span className="status-label">Bad Posture Count:</span>
              <span className="status-value count">{state.badCount}</span>
            </div>
            
            <div className="status-item">
              <span className="status-label">Sitting Time:</span>
              <span className="status-value timer">{state.sittingTime}</span>
            </div>
          </div>
          
          {/* Break Alert */}
          {state.showBreakAlert && (
            <div className="break-alert">
              <p>⚠️ You've been sitting for over 10 minutes — Take a break and stretch!</p>
              <button className="btn btn-primary" onClick={handleBreakAlertDismiss}>
                I Stretched! ✅
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}