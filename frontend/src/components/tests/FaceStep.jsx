import { useState, useEffect, useRef } from 'react';
import { analyzeFace } from '../../services/apiService.js';

const ACTIVITIES = [
  {
    id: 'neutral',
    title: 'Hold a neutral expression',
    helper: 'Look straight at the camera and relax your face. Hold still for 3 seconds.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="14" stroke="#7C6AF7" strokeWidth="1.5"/>
        <circle cx="13" cy="15" r="1.5" fill="#7C6AF7"/>
        <circle cx="23" cy="15" r="1.5" fill="#7C6AF7"/>
        <line x1="12" y1="23" x2="24" y2="23" stroke="#7C6AF7" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'smile',
    title: 'Smile naturally',
    helper: 'Show your teeth in a relaxed, natural smile.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="14" stroke="#7C6AF7" strokeWidth="1.5"/>
        <circle cx="13" cy="15" r="1.5" fill="#7C6AF7"/>
        <circle cx="23" cy="15" r="1.5" fill="#7C6AF7"/>
        <path d="M12 21 Q18 27 24 21" stroke="#7C6AF7" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  },
  {
    id: 'eyebrows',
    title: 'Raise your eyebrows',
    helper: 'Raise both eyebrows as high as you can and hold.',
    icon: (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="14" stroke="#7C6AF7" strokeWidth="1.5"/>
        <path d="M10 13 Q13 10 16 13" stroke="#7C6AF7" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <path d="M20 13 Q23 10 26 13" stroke="#7C6AF7" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <circle cx="13" cy="18" r="1.5" fill="#7C6AF7"/>
        <circle cx="23" cy="18" r="1.5" fill="#7C6AF7"/>
        <line x1="12" y1="25" x2="24" y2="25" stroke="#7C6AF7" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function FaceStep({ onComplete, onSkip, onPhotoCapture }) {
  const [cameraState, setCameraState]     = useState('loading'); // loading | active | error
  const [errorMsg, setErrorMsg]           = useState('');