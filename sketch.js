import './style.css';
import OpenAI from 'openai';

const openAIKey = import.meta.env.VITE_OPENAI_KEY;

let openai;
let isLoading = false;
let scrollingText = "press spacebar to start inference"; 
let textPositions = new Array(5); // Array for 5 text positions
const SCROLL_SPEED = 10;
const SPACING = 200;
let BAND_HEIGHT;
let fontSize;
const COLORS = ['#5bc0eb', '#fde74c', '#9bc53d', '#e55934', '#fa7921']; // Color array for bands
const BG_COLOR = '#000000'; // Keep black background
let loadingPhase = 0; // Track loading a nimation phase
let audioContext;
let isAudioInitialized = false;   
let activeOscillators = null;

// Add new constants and variables for dynamic movement
const SPEED_VARIATIONS = [0, 5, 10, 15, 20 ];
const DIRECTION_CHANGE_PROBABILITY = 0.01; // 1% chance per frame
const STOP_PROBABILITY = 0.005; // 0.5% chance to stop
const STOP_DURATION = 1000; // Stop for 1 second
let currentSpeeds = new Array(5).fill(SCROLL_SPEED);
let stopTimers = new Array(5).fill(0);
let directions = new Array(5).fill(1);

// Add sound control variables
const MINIMUM_SOUND_INTERVAL = 2000; // Minimum 2 seconds between sounds
let lastSoundTime = 0;

// Modify the color swap probability to be much lower
const COLOR_SWAP_PROBABILITY = 0.001; // 0.1% chance per frame to swap colors
const COLOR_SWAP_COOLDOWN = 3000; // Minimum 3 seconds between color swaps
let lastColorSwap = 0;

let currentColors = [...COLORS]; // Make a copy of the original colors

// Add generation state variables
const GENERATION_INTERVAL = 30000; // 30 seconds
let isGenerating = false;
let lastGenerationTime = 0;

const sketch = p => {
  p.setup = function() {
    BAND_HEIGHT = p.windowHeight / 5;
    p.createCanvas(p.windowWidth, p.windowHeight);
    fontSize = BAND_HEIGHT - 30;
    p.textFont('Helvetica');
    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER); // Center both horizontally and vertically
    
    for (let i = 0; i < 5; i++) {
      textPositions[i] = i % 2 === 0 ? p.width : 0;
      directions[i] = i % 2 === 0 ? -1 : 1;
      currentSpeeds[i] = SCROLL_SPEED;
      stopTimers[i] = 0;
    }
  };

  p.windowResized = function() {
    BAND_HEIGHT = p.windowHeight / 5;
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    fontSize = BAND_HEIGHT - 30; // Reduced by 30 pixels
    p.textSize(fontSize);
    p.textLeading(BAND_HEIGHT);
  };

  p.keyPressed = function() {
    if (p.keyCode === 32) { // Spacebar
      isGenerating = !isGenerating; // Toggle generation state
      isLoading = true;
      if (isGenerating) {
        generateNewText();
      } else {
        stopActiveSound();
      }
    }
  };
 
  async function chat(prompt) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        temperature: 0.8,
        messages: [{ "role": "user", "content": prompt }]
      });

      // Remove punctuation and convert to lowercase
      scrollingText = completion.choices[0].message.content
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove punctuation
        .replace(/\n/g, " ")
        .toLowerCase();
      
      for (let i = 0; i < 5; i++) {
        textPositions[i] = i % 2 === 0 ? p.width : 0;
      }
      isLoading = false;
      playTextAppearSound();
    } catch (err) {
      console.error("An error occurred in the chat function:", err);
      isLoading = false;
      scrollingText = "error occurred press spacebar to try again";
    }
  }

  function generateNewText() {
    chat("hey i want to tell you about this thing that happens when youre reading right now your eyes are doing this prediction dance across these words and your brain is running this amazing active inference loop where every saccade every tiny eye movement is really a question a hypothesis about whats coming next and your visual system is saying hey is this the word i think it is and sometimes it is and sometimes it isnt and thats how you learn by testing these predictions against what you actually see and isnt it beautiful how reading is really just this endless cycle of action and perception where your eye movements are actions guided by your predictions and every fixation is a test of those predictions and your brain is constantly updating its model of the text like some kind of neural scientist running experiments with every glance and when the predictions are wrong thats when the learning happens thats when your brain adjusts its model and gets better at surfing these waves of symbols and meaning oh superman oh judge oh mom and dad");
  }

  p.draw = function() {
    const now = Date.now();
    
    // Check if we should generate new text
    if (isGenerating && now - lastGenerationTime > GENERATION_INTERVAL) {
      generateNewText();
      lastGenerationTime = now;
    }

    p.background(BG_COLOR);
    
    if (isLoading) {
      displayLoader(p);
    } else {
      // Modify the color swapping check in draw
      if (Math.random() < COLOR_SWAP_PROBABILITY && 
          Date.now() - lastColorSwap > COLOR_SWAP_COOLDOWN) {
        swapRandomColors();
        lastColorSwap = Date.now();
      }

      // Draw colored bands with current colors
      for (let i = 0; i < 5; i++) {
        p.fill(currentColors[i]);
        p.rect(0, BAND_HEIGHT * i, p.width, BAND_HEIGHT);
      }
      
      // Draw text with dynamic movement
      p.fill(255);
      for (let i = 0; i < 5; i++) {
        const yPos = BAND_HEIGHT * (i + 0.5);
        drawScrollingText(p, textPositions[i], yPos);
        
        // Check if stopped
        if (stopTimers[i] > now) {
          continue; // Skip movement if stopped
        }
        
        // Random direction and speed changes
        if (Math.random() < DIRECTION_CHANGE_PROBABILITY) {
          directions[i] *= -1; // Reverse direction
          currentSpeeds[i] = SPEED_VARIATIONS[Math.floor(Math.random() * SPEED_VARIATIONS.length)];
        }
        
        // Random stops
        if (Math.random() < STOP_PROBABILITY) {
          stopTimers[i] = now + STOP_DURATION;
          continue;
        }
        
        // Update positions with current speed and direction
        textPositions[i] += currentSpeeds[i] * directions[i];
        
        // Reset positions
        if (directions[i] < 0) {
          if (textPositions[i] < -(p.textWidth(scrollingText) + SPACING)) {
            textPositions[i] = p.width;
            if (shouldTriggerSound()) {
              playTextAppearSound();
            }
          }
        } else {
          if (textPositions[i] > p.width + SPACING) {
            textPositions[i] = -p.textWidth(scrollingText);
            if (shouldTriggerSound()) {
              playTextAppearSound();
            }
          }
        }
      }
    }
  };
};

function drawScrollingText(p, startX, yPos) {
  let currentX = startX;
  
  // Forward text
  while (currentX < p.width) {
    p.text(scrollingText, currentX + p.textWidth(scrollingText)/2, yPos); // Center text around x position
    currentX += p.textWidth(scrollingText) + SPACING;
  }
  
  // Backward text to fill gaps
  currentX = startX - p.textWidth(scrollingText) - SPACING;
  while (currentX + p.textWidth(scrollingText) > 0) {
    p.text(scrollingText, currentX + p.textWidth(scrollingText)/2, yPos); // Center text around x position
    currentX -= p.textWidth(scrollingText) + SPACING;
  }
}

function displayLoader(p) {
  p.noStroke();
  
  // Draw all bands in black first
  for (let i = 0; i < 5; i++) {
    p.fill(BG_COLOR);
    p.rect(0, BAND_HEIGHT * i, p.width, BAND_HEIGHT);
  }
  
  // Animate colored bands sequentially
  const numBandsToShow = Math.floor(loadingPhase);
  for (let i = 0; i < numBandsToShow; i++) {
    p.fill(currentColors[i]);
    p.rect(0, BAND_HEIGHT * i, p.width, BAND_HEIGHT);
  }
  
  // Animate the current band partially
  if (numBandsToShow < 5) {
    const partialWidth = (loadingPhase % 1) * p.width;
    p.fill(currentColors[numBandsToShow]);
    p.rect(0, BAND_HEIGHT * numBandsToShow, partialWidth, BAND_HEIGHT);
  }
  
  // Add loading text
  p.fill(255); // White text
  p.textSize(fontSize);
  p.textAlign(p.CENTER, p.CENTER);
  p.text("starting inference", p.width/2, p.height/2);
  
  // Update animation phase
  loadingPhase += 0.02;
  if (loadingPhase >= 5) {
    loadingPhase = 0;
  }
}

function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  isAudioInitialized = true;
}

function analyzeTextComplexity(text) {
  // Get unique words count
  const words = text.split(' ');
  const uniqueWords = new Set(words);
  
  return {
    length: text.length,
    wordCount: words.length,
    uniqueWordCount: uniqueWords.size,
    // Normalize values between 0 and 1
    complexity: Math.min(words.length / 200, 1), // Assume max 200 words
    variety: uniqueWords.size / words.length
  };
}

function shouldTriggerSound() {
  const now = Date.now();
  if (now - lastSoundTime > MINIMUM_SOUND_INTERVAL) {
    lastSoundTime = now;
    return true;
  }
  return false;
}

function stopActiveSound() {
  if (activeOscillators) {
    const now = audioContext.currentTime;
    
    // Stop all oscillators
    Object.values(activeOscillators).forEach(node => {
      if (node) {
        if (node.stop && typeof node.stop === 'function') {
          try {
            node.stop(now);
          } catch (e) {
            // Ignore stop errors
          }
        }
        if (node.disconnect && typeof node.disconnect === 'function') {
          try {
            node.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
        }
      }
    });

    // Clear any intervals
    if (activeOscillators.rhythmInterval) {
      clearInterval(activeOscillators.rhythmInterval);
    }

    activeOscillators = null;
  }
}

function playTextAppearSound() {
  if (!isAudioInitialized) {
    initAudio();
  }

  stopActiveSound();

  const analysis = analyzeTextComplexity(scrollingText);
  
  // Create oscillator bank
  const oscillators = {
    bass: audioContext.createOscillator(),
    sub: audioContext.createOscillator(),
    lead1: audioContext.createOscillator(),
    lead2: audioContext.createOscillator(),
    rhythm1: audioContext.createOscillator(),
    rhythm2: audioContext.createOscillator(),
    lfo1: audioContext.createOscillator(),
    lfo2: audioContext.createOscillator()
  };
  
  // Create gain nodes and effects
  const gains = {
    bass: audioContext.createGain(),
    sub: audioContext.createGain(),
    lead: audioContext.createGain(),
    rhythm: audioContext.createGain(),
    master: audioContext.createGain(),
    lfo1: audioContext.createGain(),
    lfo2: audioContext.createGain()
  };
  
  // Create filters
  const filters = {
    bass: audioContext.createBiquadFilter(),
    lead: audioContext.createBiquadFilter(),
    rhythm: audioContext.createBiquadFilter()
  };
  
  // Complex routing
  oscillators.bass.connect(filters.bass);
  oscillators.sub.connect(filters.bass);
  filters.bass.connect(gains.bass);
  gains.bass.connect(gains.master);
  
  oscillators.lead1.connect(filters.lead);
  oscillators.lead2.connect(filters.lead);
  filters.lead.connect(gains.lead);
  gains.lead.connect(gains.master);
  
  oscillators.rhythm1.connect(filters.rhythm);
  oscillators.rhythm2.connect(filters.rhythm);
  filters.rhythm.connect(gains.rhythm);
  gains.rhythm.connect(gains.master);
  
  gains.master.connect(audioContext.destination);
  
  oscillators.lfo1.connect(gains.lfo1);
  oscillators.lfo2.connect(gains.lfo2);
  gains.lfo1.connect(filters.lead.frequency);
  gains.lfo2.connect(filters.rhythm.frequency);
  
  const now = audioContext.currentTime;
  
  // Base frequencies
  const baseFreq = 55 + (analysis.complexity * 55);
  const rhythmFreq = baseFreq * 2;
  const beatRate = 0.25 + (analysis.variety * 0.5); // Beat frequency in Hz
  
  // Set oscillator types and frequencies
  oscillators.bass.type = 'sawtooth';
  oscillators.sub.type = 'sine';
  oscillators.lead1.type = 'square';
  oscillators.lead2.type = 'sawtooth';
  oscillators.rhythm1.type = 'triangle';
  oscillators.rhythm2.type = 'square';
  oscillators.lfo1.type = 'sine';
  oscillators.lfo2.type = 'triangle';
  
  // Set filter types
  filters.bass.type = 'lowpass';
  filters.lead.type = 'bandpass';
  filters.rhythm.type = 'highpass';
  
  // Set frequencies
  oscillators.bass.frequency.setValueAtTime(baseFreq, now);
  oscillators.sub.frequency.setValueAtTime(baseFreq/2, now);
  oscillators.lead1.frequency.setValueAtTime(baseFreq * 2, now);
  oscillators.lead2.frequency.setValueAtTime(baseFreq * 2.02, now);
  oscillators.rhythm1.frequency.setValueAtTime(rhythmFreq, now);
  oscillators.rhythm2.frequency.setValueAtTime(rhythmFreq * 1.5, now);
  oscillators.lfo1.frequency.setValueAtTime(beatRate, now);
  oscillators.lfo2.frequency.setValueAtTime(beatRate * 1.5, now);
  
  // Rhythmic modulation
  const beatInterval = 1000 / beatRate; // Convert to milliseconds
  const rhythmInterval = setInterval(() => {
    const time = audioContext.currentTime;
    
    // Rhythmic volume changes
    gains.rhythm.gain.setValueAtTime(gains.rhythm.gain.value, time);
    gains.rhythm.gain.linearRampToValueAtTime(0.2, time + 0.05);
    gains.rhythm.gain.linearRampToValueAtTime(0.05, time + 0.2);
    
    // Filter sweeps
    filters.rhythm.frequency.exponentialRampToValueAtTime(2000, time + 0.05);
    filters.rhythm.frequency.exponentialRampToValueAtTime(500, time + 0.2);
  }, beatInterval);
  
  // Filter and modulation settings
  filters.bass.frequency.setValueAtTime(200, now);
  filters.lead.frequency.setValueAtTime(500, now);
  filters.rhythm.frequency.setValueAtTime(1000, now);
  
  gains.lfo1.gain.setValueAtTime(200 + (analysis.variety * 500), now);
  gains.lfo2.gain.setValueAtTime(300 + (analysis.variety * 700), now);
  
  // Set initial gains
  gains.bass.gain.setValueAtTime(0.3, now);
  gains.sub.gain.setValueAtTime(0.2, now);
  gains.lead.gain.setValueAtTime(0.1, now);
  gains.rhythm.gain.setValueAtTime(0.1, now);
  gains.master.gain.setValueAtTime(0, now);
  gains.master.gain.linearRampToValueAtTime(0.1 + (analysis.complexity * 0.05), now + 0.1);
  
  // Start all oscillators
  Object.values(oscillators).forEach(osc => osc.start(now));
  
  // Store for cleanup
  activeOscillators = {
    ...oscillators,
    ...gains,
    ...filters,
    rhythmInterval // Store the interval for cleanup
  };
}

function onReady() {
  openai = new OpenAI({
    apiKey: openAIKey,
    dangerouslyAllowBrowser: true
  });

  const mainElt = document.querySelector('main');
  new p5(sketch, mainElt);
}

if (document.readyState === 'complete') {
  onReady();
} else {
  document.addEventListener("DOMContentLoaded", onReady);
}

// Add color swapping function
function swapRandomColors() {
  const index1 = Math.floor(Math.random() * currentColors.length);
  let index2 = Math.floor(Math.random() * (currentColors.length - 1));
  if (index2 >= index1) index2++; // Avoid same index
  
  // Swap colors
  const temp = currentColors[index1];
  currentColors[index1] = currentColors[index2];
  currentColors[index2] = temp;
}



