import './style.css';
import OpenAI from 'openai';

const openAIKey = import.meta.env.VITE_OPENAI_KEY;

let openai;
let isLoading = false;
let scrollingText = "press space bar to start active inference on the origins of writing, translation, knowledge, and power"; 
let textPositions = []; // Remove fixed size initialization
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
let currentSpeeds = []; // Remove fixed size
let stopTimers = []; // Remove fixed size
let directions = []; // Remove fixed size

// Add sound control variables
const MINIMUM_SOUND_INTERVAL = 2000; // Minimum 2 seconds between sounds
let lastSoundTime = 0;

// Modify the color swap probability to be much lower
const COLOR_SWAP_PROBABILITY = 0.001; // 0.1% chance per frame to swap colors
const COLOR_SWAP_COOLDOWN = 3000; // Minimum 3 seconds between color swaps
let lastColorSwap = 0;

let currentColors = [...COLORS]; // Make a copy of the original colors

// Add generation state variables
const GENERATION_INTERVAL = 60000; // 60 seconds
let isGenerating = false;
let lastGenerationTime = 0;

// Add after the other constants
const LANGUAGES = {
  'English': 'english',
  'Spanish': 'spanish',
  'French': 'french',
  'German': 'german',
  'Italian': 'italian',
  'Portuguese': 'portuguese',
  'Russian': 'russian',
  'Japanese': 'japanese',
  'Chinese': 'chinese',
  'Korean': 'korean',
  'Arabic': 'arabic',
  'Hindi': 'hindi',
  'Turkish': 'turkish',
  'Dutch': 'dutch',
  'Polish': 'polish',
  'Swedish': 'swedish',
  'Greek': 'greek',
  'Vietnamese': 'vietnamese',
  'Thai': 'thai',
  'Hebrew': 'hebrew',
  // African languages
  'Swahili': 'swahili',
  'Yoruba': 'yoruba',
  'Zulu': 'zulu',
  'Amharic': 'amharic',
  'Hausa': 'hausa',
  'Igbo': 'igbo',
  'Xhosa': 'xhosa',
  'Twi': 'twi',
  'Somali': 'somali',
  'Oromo': 'oromo',
  // Indigenous languages
  'Nahuatl': 'nahuatl',     // Aztec
  'Quechua': 'quechua',     // Inca
  'Maya': 'maya',           // Mayan
  'Guarani': 'guarani',     // Paraguay/South America
  'Navajo': 'navajo',       // North America
  'Cherokee': 'cherokee',   // North America
  'Maori': 'maori',         // New Zealand
  'Hawaiian': 'hawaiian',   // Hawaii
  'Ainu': 'ainu',           // Japan
  'Sami': 'sami'           // Nordic indigenous
};

let currentLanguage = 'English';
let languageMenuOpen = false;
let languageButtonSize = 40;
let languageMenuWidth = 150;
let languageMenuHeight = 300; // Fixed height for visibility
let languageScrollOffset = 0;

// Add vertical writing system languages
const VERTICAL_LANGUAGES = new Set([
  'Chinese',
  'Japanese',
  'Korean',
  'Mongolian'
]);

// Add constants for band counts
const HORIZONTAL_BAND_COUNT = 5;
const VERTICAL_BAND_COUNT = 5;

// Add color swap timing
const COLOR_SWAP_INTERVAL = 2000; // Swap colors every 2 seconds
let lastColorSwapTime = 0;

// Add text color array
let textColors = [...COLORS]; // Separate array for text colors

// Add UI constants
const UI = {
  padding: 20,
  buttonSize: 40,
  menuWidth: 150,
  menuHeight: 300
};

// Add initial state tracking
let hasLanguageBeenSelected = false;

// Add language rotation timing
const LANGUAGE_CHANGE_INTERVAL = 60000; // 60 seconds
let lastLanguageChangeTime = 0;

// Add sound initialization variables at the top with other variables
let isSoundInitialized = false;

const sketch = p => {
  p.setup = function() {
    const isVertical = VERTICAL_LANGUAGES.has(currentLanguage);
    if (isVertical) {
      BAND_HEIGHT = p.windowWidth / VERTICAL_BAND_COUNT;
      fontSize = BAND_HEIGHT * 0.8;
    } else {
      BAND_HEIGHT = p.windowHeight / HORIZONTAL_BAND_COUNT;
      fontSize = BAND_HEIGHT - 30;
    }
    
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.textFont('Helvetica');
    p.textSize(fontSize);
    p.textAlign(p.CENTER, p.CENTER);
    
    // Initialize positions based on direction
    const bandCount = HORIZONTAL_BAND_COUNT;
    textPositions = new Array(bandCount).fill(0);
    directions = new Array(bandCount).fill(1);
    currentSpeeds = new Array(bandCount).fill(SCROLL_SPEED);
    stopTimers = new Array(bandCount).fill(0);
    
    for (let i = 0; i < bandCount; i++) {
      if (isVertical) {
        textPositions[i] = i % 2 === 0 ? p.height : 0;
        directions[i] = i % 2 === 0 ? -1 : 1;
      } else {
        textPositions[i] = i % 2 === 0 ? p.width : 0;
        directions[i] = i % 2 === 0 ? -1 : 1;
      }
    }
  };

  p.windowResized = function() {
    const isVertical = VERTICAL_LANGUAGES.has(currentLanguage);
    if (isVertical) {
      BAND_HEIGHT = p.windowWidth / VERTICAL_BAND_COUNT;
      fontSize = BAND_HEIGHT * 0.8;
    } else {
      BAND_HEIGHT = p.windowHeight / HORIZONTAL_BAND_COUNT;
      fontSize = BAND_HEIGHT - 30;
    }
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    p.textSize(fontSize);
    p.textLeading(BAND_HEIGHT);
  };

  p.keyPressed = function() {
    if (p.keyCode === 32) { // Spacebar
      isGenerating = !isGenerating;
      if (isGenerating) {
        isLoading = true; // Show loading animation
        loadingPhase = 0; // Reset loading animation phase
        initAudio(); // Initialize audio system
        generateNewText();
        lastLanguageChangeTime = Date.now();
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
        messages: [{ 
          "role": "user", 
          "content": `Translate this to ${currentLanguage} and maintain this epistemological reflection on active inference: 
          "Through the recursive dance of writing and translation, consciousness performs its predictive synthesis, 
          a perpetual negotiation between prior knowledge and novel expression. Each act of translation becomes 
          an epistemic leap, where meaning emerges from the active inference between languages, between knowing 
          and becoming. In this cognitive choreography, we write not just to express, but to know - 
          each word a hypothesis about the nature of understanding itself."`
        }]
      });

      // Remove punctuation and convert to lowercase
      scrollingText = completion.choices[0].message.content
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove punctuation
        .replace(/\n/g, " ")
        .toLowerCase();
      
      // Initialize positions based on language type
      const isVertical = VERTICAL_LANGUAGES.has(currentLanguage);
      const bandCount = isVertical ? VERTICAL_BAND_COUNT : HORIZONTAL_BAND_COUNT;
      
      for (let i = 0; i < bandCount; i++) {
        if (isVertical) {
          textPositions[i] = i % 2 === 0 ? p.height : 0;
        } else {
          textPositions[i] = i % 2 === 0 ? p.width : 0;
        }
      }
      
      isLoading = false;
      playTextAppearSound();
    } catch (err) {
      console.error("An error occurred in the chat function:", err);
      isLoading = false;
      scrollingText = "error occurred please select a language to try again";
    }
  }

  async function generateNewText() {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        temperature: 0.8,
        messages: [{ 
          role: "user", 
          content: `Write a poetic reflection IN ${currentLanguage} LANGUAGE (not translated, but written directly in ${currentLanguage}) about writing systems, focusing on:
          - the historical evolution of this specific writing system
          - how colonization and power have shaped this language's writing
          - the unique characteristics of this script or writing tradition
          - how this writing system preserves cultural memory
          
          Important: The response must be ENTIRELY in ${currentLanguage}, not in English.
          For indigenous languages that were primarily oral, reflect on their modern written forms.`
        }]
      });

      // Remove punctuation and convert to lowercase
      scrollingText = completion.choices[0].message.content
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"]/g, "")
        .replace(/\n/g, " ")
        .toLowerCase();
      
      if (isGenerating) {
        playTextAppearSound();
      }
      
      isLoading = false;
      
    } catch (err) {
      console.error("An error occurred in the chat function:", err);
      // Set error message in the current language if possible
      if (currentLanguage === 'Spanish') {
        scrollingText = "ocurrió un error presiona la barra espaciadora para intentar de nuevo";
      } else if (currentLanguage === 'French') {
        scrollingText = "une erreur sest produite appuyez sur la barre despace pour réessayer";
      } else {
        scrollingText = "error occurred press space bar to try again";
      }
      isLoading = false;
    }
  }

  p.draw = function() {
    const now = Date.now();
    const isVertical = VERTICAL_LANGUAGES.has(currentLanguage);
    
    if (isLoading) {
      displayLoader(p);
      return; // Don't draw anything else while loading
    }
    
    p.background(BG_COLOR);
    
    // Check if we should change language and generate new text
    if (isGenerating && now - lastLanguageChangeTime > LANGUAGE_CHANGE_INTERVAL) {
      isLoading = true; // Show loading for language changes
      loadingPhase = 0; // Reset loading animation
      const availableLanguages = Object.keys(LANGUAGES).filter(lang => lang !== currentLanguage);
      const randomIndex = Math.floor(Math.random() * availableLanguages.length);
      currentLanguage = availableLanguages[randomIndex];
      
      generateNewText();
      lastLanguageChangeTime = now;
    }
    
    // Check if it's time to swap colors
    if (now - lastColorSwapTime > COLOR_SWAP_INTERVAL) {
      swapRandomColors(currentColors);
      swapRandomColors(textColors);
      lastColorSwapTime = now;
    }
    
    // Draw bands first
    for (let i = 0; i < HORIZONTAL_BAND_COUNT; i++) {
      p.fill(currentColors[i]);
      if (isVertical) {
        const bandWidth = p.width / HORIZONTAL_BAND_COUNT;
        p.rect(bandWidth * i, 0, bandWidth, p.height);
      } else {
        p.rect(0, BAND_HEIGHT * i, p.width, BAND_HEIGHT);
      }
    }
    
    // Draw scrolling text with corresponding colors
    for (let i = 0; i < HORIZONTAL_BAND_COUNT; i++) {
      const xPos = isVertical ? (p.width / HORIZONTAL_BAND_COUNT) * (i + 0.5) : textPositions[i];
      const yPos = isVertical ? textPositions[i] : BAND_HEIGHT * (i + 0.5);
      
      p.fill(textColors[i]); // Use text color array
      drawScrollingText(p, xPos, yPos);
      
      // Skip if stopped
      if (stopTimers[i] > now) continue;
      
      // Random direction and speed changes for both vertical and horizontal
      if (Math.random() < DIRECTION_CHANGE_PROBABILITY) {
        directions[i] *= -1;
        currentSpeeds[i] = SPEED_VARIATIONS[Math.floor(Math.random() * SPEED_VARIATIONS.length)];
      }
      
      // Random stops for both vertical and horizontal
      if (Math.random() < STOP_PROBABILITY) {
        stopTimers[i] = now + STOP_DURATION;
        continue;
      }
      
      // Update positions
      textPositions[i] += currentSpeeds[i] * directions[i];
      
      // Reset positions based on direction
      if (isVertical) {
        if (directions[i] < 0) {
          if (textPositions[i] < -p.height) {
            textPositions[i] = p.height;
            if (shouldTriggerSound()) playTextAppearSound();
          }
        } else {
          if (textPositions[i] > p.height * 2) {
            textPositions[i] = -p.height;
            if (shouldTriggerSound()) playTextAppearSound();
          }
        }
      } else {
        // Reset positions for horizontal movement
        if (directions[i] < 0) {
          if (textPositions[i] < -(p.textWidth(scrollingText) + SPACING)) {
            textPositions[i] = p.width;
            if (shouldTriggerSound()) playTextAppearSound();
          }
        } else {
          if (textPositions[i] > p.width + SPACING) {
            textPositions[i] = -p.textWidth(scrollingText);
            if (shouldTriggerSound()) playTextAppearSound();
          }
        }
      }
    }
    
    drawLanguageSelector();
  };

  function drawLanguageSelector() {
    const x = UI.padding;
    const y = p.height - UI.padding - languageButtonSize;
    
    // Save current text settings
    const currentAlign = p.textAlign();
    const currentSize = fontSize;
    
    // Draw main button with hover effect
    p.noStroke();
    const isButtonHovered = p.mouseX >= x && p.mouseX <= x + languageButtonSize &&
                           p.mouseY >= y && p.mouseY <= y + languageButtonSize;
    p.fill(isButtonHovered ? 200 : 255);
    p.rect(x, y, languageButtonSize, languageButtonSize, 5);
    p.fill(0);
    p.textSize(20);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(currentLanguage.slice(0, 2).toUpperCase(), x + languageButtonSize/2, y + languageButtonSize/2);

    // Draw dropdown menu if open
    if (languageMenuOpen) {
      p.textSize(16);
      Object.keys(LANGUAGES).forEach((lang, i) => {
        const yPos = y - languageMenuHeight + (i * 30) + languageScrollOffset;
        
        // Only draw if in visible area
        if (yPos > y - languageMenuHeight - 30 && yPos < y + 30) {
          // Check if mouse is over this item
          const isHovered = p.mouseX >= x && p.mouseX <= x + languageMenuWidth &&
                           p.mouseY >= yPos && p.mouseY <= yPos + 30;
          
          // Draw background for selected or hovered items
          if (lang === currentLanguage || isHovered) {
            p.fill(255, lang === currentLanguage ? 100 : 50);
            p.rect(x, yPos, languageMenuWidth, 30, 5);
          }
          
          // Draw language text
          p.fill(255);
          p.textAlign(p.LEFT, p.CENTER);
          p.text(lang, x + 10, yPos + 15);
        }
      });
    }
    
    // Restore original text settings
    p.textSize(currentSize);
    p.textAlign(currentAlign);
  }

  p.mousePressed = function() {
    // Language selector click handling
    const buttonX = UI.padding;
    const buttonY = p.height - UI.padding - languageButtonSize;
    
    if (p.mouseX >= buttonX && p.mouseX <= buttonX + languageButtonSize &&
        p.mouseY >= buttonY && p.mouseY <= buttonY + languageButtonSize) {
      languageMenuOpen = !languageMenuOpen;
      return;
    }
    
    if (languageMenuOpen &&
        p.mouseX >= buttonX && p.mouseX <= buttonX + languageMenuWidth &&
        p.mouseY >= buttonY - languageMenuHeight && p.mouseY <= buttonY) {
      const index = Math.floor((p.mouseY - (buttonY - languageMenuHeight) - languageScrollOffset) / 30);
      const newLang = Object.keys(LANGUAGES)[index];
      if (newLang && newLang !== currentLanguage) {
        currentLanguage = newLang;
        languageMenuOpen = false;
        isLoading = true;
        hasLanguageBeenSelected = true; // Set flag on first selection
        generateNewText();
        lastGenerationTime = Date.now(); // Reset generation timer
      }
    } else if (!isClickInMenu(p.mouseX, p.mouseY)) {
      languageMenuOpen = false;
    }
  };

  function isClickInMenu(x, y) {
    const buttonX = UI.padding;
    const buttonY = p.height - UI.padding - languageButtonSize;
    return (
      x >= buttonX && 
      x <= buttonX + languageMenuWidth &&
      y >= buttonY - languageMenuHeight &&
      y <= buttonY + languageButtonSize
    );
  }
};

// Modify drawScrollingText function to handle vertical text
function drawScrollingText(p, startX, yPos) {
  if (VERTICAL_LANGUAGES.has(currentLanguage)) {
    drawVerticalText(p, startX, yPos);
  } else {
    drawHorizontalText(p, startX, yPos);
  }
}

// Split the original horizontal text drawing
function drawHorizontalText(p, startX, yPos) {
  let currentX = startX;
  
  // Color is already set in draw function
  while (currentX < p.width) {
    p.text(scrollingText, currentX + p.textWidth(scrollingText)/2, yPos);
    currentX += p.textWidth(scrollingText) + SPACING;
  }
  
  currentX = startX - p.textWidth(scrollingText) - SPACING;
  while (currentX + p.textWidth(scrollingText) > 0) {
    p.text(scrollingText, currentX + p.textWidth(scrollingText)/2, yPos);
    currentX -= p.textWidth(scrollingText) + SPACING;
  }
}

// Add vertical text drawing
function drawVerticalText(p, startX, yPos) {
  p.push();
  p.textAlign(p.CENTER, p.CENTER);
  
  let currentY = yPos;
  const textHeight = p.textAscent() + p.textDescent();
  const totalHeight = textHeight * scrollingText.length;
  const charSpacing = textHeight * 1.2;
  
  // Center text in band
  const bandCenter = startX;
  
  // Draw text moving up/down with improved spacing
  while (currentY < p.height) {
    drawVerticalString(p, scrollingText, bandCenter, currentY, charSpacing);
    currentY += totalHeight + SPACING;
  }
  
  currentY = yPos - totalHeight - SPACING;
  while (currentY + totalHeight > 0) {
    drawVerticalString(p, scrollingText, bandCenter, currentY, charSpacing);
    currentY -= totalHeight + SPACING;
  }
  
  p.pop();
}

// Improved vertical string drawing
function drawVerticalString(p, str, x, y, charSpacing) {
  const chars = str.split('');
  
  p.push();
  p.translate(x, y);
  
  chars.forEach((char, i) => {
    p.push();
    if (VERTICAL_LANGUAGES.has(currentLanguage)) {
      p.translate(0, i * charSpacing);
    } else {
      p.translate(0, i * charSpacing);
      p.rotate(p.PI/2);
    }
    // Color is already set in draw function
    p.text(char, 0, 0);
    p.pop();
  });
  
  p.pop();
}

function displayLoader(p) {
  p.background(BG_COLOR); // Clear background first
  p.noStroke();
  const isVertical = VERTICAL_LANGUAGES.has(currentLanguage);
  
  if (isVertical) {
    const bandWidth = p.width / HORIZONTAL_BAND_COUNT;
    
    // Draw vertical bands
    for (let i = 0; i < HORIZONTAL_BAND_COUNT; i++) {
      p.fill(BG_COLOR);
      p.rect(bandWidth * i, 0, bandWidth, p.height);
    }
    
    // Animate colored bands sequentially
    const numBandsToShow = Math.floor(loadingPhase);
    for (let i = 0; i < numBandsToShow; i++) {
      p.fill(currentColors[i]);
      p.rect(bandWidth * i, 0, bandWidth, p.height);
    }
    
    // Animate the current band partially
    if (numBandsToShow < HORIZONTAL_BAND_COUNT) {
      const partialHeight = (loadingPhase % 1) * p.height;
      p.fill(currentColors[numBandsToShow]);
      p.rect(bandWidth * numBandsToShow, 0, bandWidth, partialHeight);
    }
  } else {
    // Original horizontal bands
    for (let i = 0; i < HORIZONTAL_BAND_COUNT; i++) {
      p.fill(BG_COLOR);
      p.rect(0, BAND_HEIGHT * i, p.width, BAND_HEIGHT);
    }
    
    const numBandsToShow = Math.floor(loadingPhase);
    for (let i = 0; i < numBandsToShow; i++) {
      p.fill(currentColors[i]);
      p.rect(0, BAND_HEIGHT * i, p.width, BAND_HEIGHT);
    }
    
    if (numBandsToShow < HORIZONTAL_BAND_COUNT) {
      const partialWidth = (loadingPhase % 1) * p.width;
      p.fill(currentColors[numBandsToShow]);
      p.rect(0, BAND_HEIGHT * numBandsToShow, partialWidth, BAND_HEIGHT);
    }
  }
  
  // Add loading text
  p.fill(255);
  p.textSize(fontSize);
  p.textAlign(p.CENTER, p.CENTER);
  p.text(currentLanguage, p.width/2, p.height/2);
  
  loadingPhase += 0.02;
  if (loadingPhase >= 5) loadingPhase = 0;
}

// Add sound initialization function
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  if (!isSoundInitialized) {
    // Initialize oscillators and other audio components
    activeOscillators = {
      bass: audioContext.createOscillator(),
      sub: audioContext.createOscillator(),
      lead: audioContext.createOscillator()
    };
    
    // Set up oscillator properties
    Object.values(activeOscillators).forEach(osc => {
      osc.connect(audioContext.destination);
      osc.start();
    });
    
    isSoundInitialized = true;
  }
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

// Update swapRandomColors to work with any color array
function swapRandomColors(colorArray) {
  const index1 = Math.floor(Math.random() * colorArray.length);
  let index2 = Math.floor(Math.random() * (colorArray.length - 1));
  if (index2 >= index1) index2++;
  
  const temp = colorArray[index1];
  colorArray[index1] = colorArray[index2];
  colorArray[index2] = temp;
}



