const canvas = document.getElementById("drawCanvas");
const ctx = canvas.getContext("2d");
const tempCanvas = document.getElementById("tempCanvas");
const tempCtx = tempCanvas.getContext("2d");
const container = document.getElementById("canvasContainer");

let undoStack = [];
let redoStack = [];

// Set fixed canvas resolution (internal drawing size)
// These values are reasonable for a default canvas that fits most screens
const CANVAS_WIDTH = 1270;
const CANVAS_HEIGHT = 610;

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
tempCanvas.width = CANVAS_WIDTH;
tempCanvas.height = CANVAS_HEIGHT;

// Fill canvas with white background
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Defaults
let currentTool = "brush";
let drawing = false;
let brushColor = "#000000";
let brushSize = 5;

let startX, startY;

// Text tool variables
let isTyping = false;
let textInput = null;
let textX = 0, textY = 0;

// Panning variables
let isPanning = false;
let panX = 0, panY = 0;
let startPanX = 0, startPanY = 0;

// Zoom - will be calculated to fit canvas in view initially
let zoomLevel = 1;

// Tool buttons
const toolButtons = document.querySelectorAll(".tool-btn");
toolButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentTool = button.getAttribute("data-tool");
    toolButtons.forEach(b => b.classList.remove("active"));
    button.classList.add("active");

    // Set cursor based on tool
    if (currentTool === "hand") {
      tempCanvas.style.cursor = "grab";
    } else if (currentTool === "text") {
      tempCanvas.style.cursor = "text";
    } else if (currentTool === "fill") {
      tempCanvas.style.cursor = "pointer";
    } else {
      tempCanvas.style.cursor = "crosshair";
    }

    // If Clear clicked, wipe both main and temporary canvas immediately
    if (currentTool === "clear") {
      // Refill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Reset to brush and active state (default tool)
      currentTool = "brush";
      button.classList.remove("active");
      toolButtons.forEach(b => {
        if (b.getAttribute("data-tool") === "brush") b.classList.add("active");
      });

      // Save to undo/redo stack
      saveState();
    }
  });
});

// Coordinate Conversion Function to find canvas coordinates
function getCanvasCoordinates(e) {
  const rect = tempCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / zoomLevel;
  const y = (e.clientY - rect.top) / zoomLevel;
  return { x, y };
}

// ---------- Mouse Events ----------
// mousedown (click + hold)
tempCanvas.addEventListener("mousedown", (e) => {
  const coords = getCanvasCoordinates(e);
  startX = coords.x;
  startY = coords.y;

  // Hand (panning)
  if (currentTool === "hand") {
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    tempCanvas.style.cursor = "grabbing";
    return;
  }

  // Text tool - create input field
  if (currentTool === "text") {
    createTextInput(e.clientX, e.clientY, coords.x, coords.y);
    return;
  }

  // Fill tool - flood fill the area
  if (currentTool === "fill") {
    floodFill(Math.floor(coords.x), Math.floor(coords.y), brushColor);
    // Save to undo/redo stack
    saveState();
    return;
  }

  // Brush / Eraser start drawing
  if (currentTool === "brush" || currentTool === "eraser") {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    return;
  }

  // For shapes: start drawing/preview on temp canvas
  drawing = true;
});

// mousemove (hold + move)
tempCanvas.addEventListener("mousemove", (e) => {
  // panning takes priority
  if (isPanning && currentTool === "hand") {
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    updateTransform();
    return;
  }

  if (!drawing) return;

  const coords = getCanvasCoordinates(e);

  // Brush / Eraser draw directly on main canvas
  if (currentTool === "brush" || currentTool === "eraser") {
    ctx.strokeStyle = currentTool === "eraser" ? "#ffffff" : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    return;
  }

  // If tool is not hand, brush, nor eraser, it automatically means shapes.
  // Shape preview on temp canvas
  tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

  const x2 = coords.x;
  const y2 = coords.y;

  tempCtx.strokeStyle = brushColor;
  tempCtx.lineWidth = brushSize;

  // Shape drawing
  if (currentTool === "line") {
    drawLine(tempCtx, startX, startY, x2, y2);
  } else if (currentTool === "rect") {
    tempCtx.strokeRect(startX, startY, x2 - startX, y2 - startY);
  } else if (currentTool === "circle") {
    const radius = Math.sqrt((x2 - startX) ** 2 + (y2 - startY) ** 2);
    tempCtx.beginPath();
    tempCtx.arc(startX, startY, radius, 0, Math.PI * 2);
    tempCtx.stroke();
  } else if (currentTool === "triangle") {
    tempCtx.beginPath();
    tempCtx.moveTo(startX, y2);
    tempCtx.lineTo((startX + x2) / 2, startY);
    tempCtx.lineTo(x2, y2);
    tempCtx.closePath();
    tempCtx.stroke();
  } else if (currentTool === "star") {
    drawStar(tempCtx, startX, startY, 5, Math.abs(x2 - startX), Math.abs(x2 - startX) / 2);
  } else if (currentTool === "arrow") {
    drawArrow(tempCtx, startX, startY, x2, y2);
  }
});

// mouseup (release mouse)
tempCanvas.addEventListener("mouseup", (e) => {
  // If we were panning, stop and return
  if (isPanning && currentTool === "hand") {
    isPanning = false;
    tempCanvas.style.cursor = "grab";
    return;
  }

  if (!drawing) return;
  drawing = false;

  if (currentTool === "brush" || currentTool === "eraser") {
    ctx.closePath();
    // Save to undo/redo stack
    saveState();
    return;
  }

  // For shapes: draw directly on main canvas
  const coords = getCanvasCoordinates(e);

  // Same as mousemove except instead of tempCtx, it's ctx (main canvas)
  const x2 = coords.x;
  const y2 = coords.y;

  ctx.strokeStyle = brushColor;
  ctx.lineWidth = brushSize;

  if (currentTool === "line") {
    drawLine(ctx, startX, startY, x2, y2);
  } else if (currentTool === "rect") {
    ctx.strokeRect(startX, startY, x2 - startX, y2 - startY);
  } else if (currentTool === "circle") {
    const radius = Math.sqrt((x2 - startX) ** 2 + (y2 - startY) ** 2);
    ctx.beginPath();
    ctx.arc(startX, startY, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else if (currentTool === "triangle") {
    ctx.beginPath();
    ctx.moveTo(startX, y2);
    ctx.lineTo((startX + x2) / 2, startY);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.stroke();
  } else if (currentTool === "star") {
    drawStar(ctx, startX, startY, 5, Math.abs(x2 - startX), Math.abs(x2 - startX) / 2);
  } else if (currentTool === "arrow") {
    drawArrow(ctx, startX, startY, x2, y2);
  }

  // Clear temp canvas
  tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
  // Save to undo/redo stack
  saveState();
});

// mouseleave (ensure panning/drawing stop if cursor leaves)
tempCanvas.addEventListener("mouseleave", () => {
  if (isPanning && currentTool === "hand") {
    isPanning = false;
    tempCanvas.style.cursor = "grab";
  }
  if (drawing) {
    drawing = false;
    try { ctx.closePath(); } catch (e) {}
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    // Save to undo/redo stack
    saveState();
  }
});


// ---------- Text Tool ----------
function createTextInput(screenX, screenY, canvasX, canvasY) {
  // Remove any existing text input
  if (textInput) {
    finalizeText();
  }

  isTyping = true;
  textX = canvasX;
  textY = canvasY;

  // Create input element
  textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.style.position = 'fixed';
  textInput.style.left = screenX + 'px';
  textInput.style.top = screenY + 'px';
  // font size tend to be very small, so multiple brush size by 3
  textInput.style.font = `${brushSize * 3}px sans-serif`;
  textInput.style.color = brushColor;
  textInput.style.border = '2px solid #6b368f';
  textInput.style.background = 'transparent';
  textInput.style.outline = 'none';
  textInput.style.padding = '4px 8px';
  textInput.style.zIndex = '3000';
  textInput.style.minWidth = '150px';
  textInput.style.pointerEvents = 'auto';

  // attach text input to html
  document.body.appendChild(textInput);
  
  // Use setTimeout to ensure the input is focused after it's added to DOM (avoid collision with other tools)
  setTimeout(() => {
    textInput.focus();
  }, 10);

  // Handle Enter key to finalize text
  const keydownHandler = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finalizeText();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelText();
    }
  };
  textInput.addEventListener('keydown', keydownHandler);

  // Handle clicking outside of textbox to finalize - but with a flag to prevent immediate blur
  let canBlur = false;
  setTimeout(() => {
    canBlur = true;
  }, 100);

  textInput.addEventListener('blur', () => {
    if (canBlur) {
      setTimeout(() => finalizeText(), 50);
    }
  });
}

// Function to commit text to main canvas
function finalizeText() {
  if (!textInput || !isTyping) return;

  const text = textInput.value;
  if (text.trim()) {
    // Draw text on canvas
    ctx.font = `${brushSize * 3}px sans-serif`;
    ctx.fillStyle = brushColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, textX, textY);
    // Save to undo/redo stack
    saveState();
  }

  // Clean up
  if (textInput && textInput.parentNode) {
    textInput.parentNode.removeChild(textInput);
  }
  textInput = null;
  isTyping = false;
}

// remove text input when text action is cancelled ('Escape' key pressed)
function cancelText() {
  if (textInput && textInput.parentNode) {
    textInput.parentNode.removeChild(textInput);
  }
  textInput = null;
  isTyping = false;
}


// ---------- Fill Tool (Flood Fill) ----------
// Stack-based flood fill algorithm to avoid recursion stack overflow on large areas
function floodFill(startX, startY, fillColor) {
  // Get all pixel data from canvas
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data; // RGBA array: [R,G,B,A, R,G,B,A, ...]
  
  // Convert fill color from hex to RGB for pixel comparison
  const fillRGB = hexToRgb(fillColor);
  
  // Get the starting pixel's color (each pixel = 4 values: R,G,B,A)
  // Formula: (y * width + x) * 4 gives us the position in the flat array
  const startPos = (startY * canvas.width + startX) * 4;
  const startR = pixels[startPos];
  const startG = pixels[startPos + 1];
  const startB = pixels[startPos + 2];
  const startA = pixels[startPos + 3];
  
  // Early exit: if clicking on same color, nothing to fill
  if (startR === fillRGB.r && startG === fillRGB.g && startB === fillRGB.b && startA === 255) {
    return;
  }
  
  // Initialize stack with starting pixel and visited set to prevent reprocessing
  const stack = [[startX, startY]];
  const visited = new Set();
  
  // Process pixels until stack is empty
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    
    // Skip if out of bounds
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
      continue;
    }
    
    // Skip if already processed this pixel
    const key = `${x},${y}`;
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);
    
    // Get current pixel's color
    const pos = (y * canvas.width + x) * 4;
    const r = pixels[pos];
    const g = pixels[pos + 1];
    const b = pixels[pos + 2];
    const a = pixels[pos + 3];
    
    // If pixel matches the starting color, fill it and add neighbors
    if (r === startR && g === startG && b === startB && a === startA) {
      // Fill this pixel with new color
      pixels[pos] = fillRGB.r;
      pixels[pos + 1] = fillRGB.g;
      pixels[pos + 2] = fillRGB.b;
      pixels[pos + 3] = 255;
      
      // Add 4 neighboring pixels to stack (right, left, down, up)
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  }
  
  // Apply all changes back to canvas
  ctx.putImageData(imageData, 0, 0);
}

// Helper function: Convert hex color to RGB object
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// ---------- Shape Helper Functions ----------
function drawStar(ctx, x, y, points, outerRadius, innerRadius) {
  let step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < 2 * points; i++) {
    let r = (i % 2 === 0) ? outerRadius : innerRadius;
    let angle = i * step;
    ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.stroke();
}

function drawLine(ctx, fromX, fromY, toX, toY) {
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
}

function drawArrow(ctx, fromX, fromY, toX, toY) {
  const headlen = 10;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6),
             toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6),
             toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}


// ---------- UI Controls ----------

// Get brush size
const sizeInput = document.querySelector(".size-input");
sizeInput.addEventListener("input", (e) => {
  brushSize = parseInt(e.target.value, 10);
});

const decreaseBtn = document.querySelector(".btn-outline-secondary:nth-of-type(1)");
const increaseBtn = document.querySelector(".btn-outline-secondary:nth-of-type(2)");

// Brush size decrease
decreaseBtn.addEventListener("click", () => {
  brushSize = Math.max(1, brushSize - 1);
  sizeInput.value = brushSize;
});

// Brush size increase
increaseBtn.addEventListener("click", () => {
  brushSize++;
  sizeInput.value = brushSize;
});

// Color picker
const colorPicker = document.querySelector(".color-picker");
colorPicker.addEventListener("input", (e) => {
  brushColor = e.target.value;
});

// ---------- Undo / Redo System ----------
// Stack-based history management using canvas snapshots
document.getElementById("undoBtn").addEventListener("click", undo);
document.getElementById("redoBtn").addEventListener("click", redo);

// Save current canvas state to undo history
// Called after every drawing operation (brush stroke, shape, fill, etc.)
function saveState() {
  // Convert canvas to data URL (base64 PNG) and store in undo stack
  undoStack.push(canvas.toDataURL());
  
  // Clear redo stack since new action invalidates future history
  // (You can't redo after making a new change)
  redoStack = [];
}

// Undo: Go back one step in history
function undo() {
  // Need at least 2 states (current + previous) to undo
  if (undoStack.length > 1) {
    // Move current state to redo stack for potential redo
    redoStack.push(undoStack.pop());
    
    // Get the previous state (now at top of undo stack)
    const imgData = undoStack[undoStack.length - 1];
    restoreState(imgData);
  }
}

// Redo: Move forward one step in history
function redo() {
  if (redoStack.length > 0) {
    // Get state from redo stack
    const imgData = redoStack.pop();
    
    // Add it back to undo stack
    undoStack.push(imgData);
    
    // Restore that state to canvas
    restoreState(imgData);
  }
}

// Restore canvas from saved data URL
function restoreState(imgData) {
  const img = new Image();
  img.src = imgData; // Set data URL as image source
  
  // Wait for image to load, then draw it on canvas
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  };
}

// Save initial blank canvas state on page load
window.addEventListener("load", () => {
  saveState();
});

// Keyboard shortcuts for undo/redo
document.addEventListener("keydown", (e) => {
  // Ctrl+Z (Windows/Linux) or Cmd+Z (Mac) = Undo
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  }
  
  // Ctrl+Y (Windows/Linux) or Cmd+Y (Mac) = Redo
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
  }
  
  // Ctrl+Shift+Z (alternative redo shortcut, common in many apps)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    redo();
  }
});

// ---------- Zoom Slider ----------
const zoomSlider = document.getElementById("zoomRange");
const zoomOutput = document.getElementById("output");

// Start at 100% zoom
zoomLevel = 1;
zoomSlider.value = 100;
zoomOutput.textContent = "100%";

zoomSlider.addEventListener("input", (e) => {
  const value = parseInt(e.target.value, 10);
  zoomLevel = value / 100;
  updateTransform();
  zoomOutput.textContent = `${value}%`;
});

// ---------- Pan + Zoom Transform ----------
function updateTransform() {
  container.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
}

// set initial cursor
tempCanvas.style.cursor = "crosshair";

// Track save state
let isSaved = true;  

// Modify saveState() so every change = unsaved
function saveState() {
  undoStack.push(canvas.toDataURL());
  redoStack = [];
  isSaved = false;
}

// ---------- SAVE ----------
function saveDrawing() {
  const link = document.createElement("a");
  link.download = "drawing.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  isSaved = true;  // mark saved
}

// ---------- CLEAR CANVAS ----------
function clearCanvas() {
  // Refill with white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  undoStack = [];
  redoStack = [];
  saveState();
  isSaved = true;  // cleared fresh = saved state
}

// ---------- OPEN BUTTON ----------
// let user open an image file to be added to the canvas
const openBtn = document.getElementById("openBtn");
const openFileInput = document.getElementById("openFileInput");

openBtn.addEventListener("click", () => {
  openFileInput.click(); // trigger hidden file input
});

openFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const img = new Image();
    img.onload = function() {
      // Clear and reset white background
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Scale image to fit canvas while maintaining aspect ratio
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      saveState(); // push new state into undo history
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);

  // Reset file input so user can pick the same file again if needed
  e.target.value = "";
});


// ---------- NEW BUTTON ----------
document.getElementById("newBtn").addEventListener("click", () => {
  // dynamic modal based on save state
  const modalBody = document.getElementById("newModalBody");
  const modalFooter = document.getElementById("newModalFooter");
  modalBody.innerHTML = "";
  modalFooter.innerHTML = "";

  if (!isSaved) {
    // Unsaved changes → offer Save or Start New
    modalBody.textContent = "This action will clear your drawing history, do you want to save your current artwork?";
    modalFooter.innerHTML = `
      <button class="btn btn-altdark" id="modalSaveBtn">Save</button>
      <button class="btn btn-altlight" id="modalNewBtn">Start New</button>
      <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
    `;
  } else {
    // Already saved → just confirm
    modalBody.textContent = "This action will clear your drawing history, do you want to continue?";
    modalFooter.innerHTML = `
      <button class="btn btn-altdark" id="modalYesBtn">Yes</button>
      <button class="btn btn-secondary" data-bs-dismiss="modal">No</button>
    `;
  }

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById("newDrawingModal"));
  modal.show();

  // Add event handlers dynamically
  document.getElementById("modalSaveBtn")?.addEventListener("click", () => {
    saveDrawing();
    clearCanvas();
    modal.hide();
  });
  document.getElementById("modalNewBtn")?.addEventListener("click", () => {
    clearCanvas();
    modal.hide();
  });
  document.getElementById("modalYesBtn")?.addEventListener("click", () => {
    clearCanvas();
    modal.hide();
  });
});

// ---------- SAVE BUTTON ----------
document.getElementById("saveBtn").addEventListener("click", saveDrawing);

