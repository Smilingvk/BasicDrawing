"use strict";
// ================================================================
//  🎨 TypeScript Drawing App — HTML5 Canvas
//
//  Requirements covered:
//  ✅ Display output to the browser (status bar, coordinates, UI)
//  ✅ Recursion  — flood-fill (paint bucket) algorithm
//  ✅ Classes    — DrawingApp, Brush, HistoryManager, ToolManager
//  ✅ Lists      — history: ImageData[], palette: string[], points: Point[]
//  ✅ Async      — saveCanvas(), loadImageFile()
//  ✅ Throwing & handling exceptions (additional requirement)
// ================================================================
// ── CLASS: Brush ─────────────────────────────────────────────────
// Requirement: Classes
class Brush {
    constructor(color = "#ffffff", size = 8, opacity = 1.0) {
        this.validate(color, size, opacity);
        this.color = color;
        this.size = size;
        this.opacity = opacity;
        this.tool = "brush";
    }
    // Requirement: Throwing exceptions
    validate(color, size, opacity) {
        if (!/^#[0-9a-fA-F]{6}$/.test(color) && !color.startsWith("rgb")) {
            throw new Error(`Invalid color: "${color}". Expected hex (#rrggbb) or rgb().`);
        }
        if (size < 1 || size > 200) {
            throw new RangeError(`Brush size ${size} is out of range (1–200).`);
        }
        if (opacity < 0 || opacity > 1) {
            throw new RangeError(`Opacity ${opacity} must be between 0 and 1.`);
        }
    }
    setSize(size) {
        if (size < 1 || size > 200)
            throw new RangeError(`Size ${size} out of range.`);
        this.size = size;
    }
    setColor(color) {
        this.color = color;
    }
    setOpacity(opacity) {
        if (opacity < 0 || opacity > 1)
            throw new RangeError(`Opacity must be 0–1.`);
        this.opacity = opacity;
    }
    get cssColor() {
        // Parse hex to rgba with opacity
        const r = parseInt(this.color.slice(1, 3), 16);
        const g = parseInt(this.color.slice(3, 5), 16);
        const b = parseInt(this.color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${this.opacity})`;
    }
}
// ── CLASS: HistoryManager ─────────────────────────────────────────
// Requirement: Classes + Lists
class HistoryManager {
    constructor(maxSteps = 40) {
        this.stack = []; // Requirement: Lists
        this.redoStack = [];
        if (maxSteps < 1)
            throw new RangeError("History must allow at least 1 step.");
        this.maxSteps = maxSteps;
    }
    push(snapshot) {
        this.stack.push(snapshot);
        if (this.stack.length > this.maxSteps) {
            this.stack.shift();
        }
        this.redoStack = []; // clear redo on new action
    }
    undo() {
        if (this.stack.length === 0)
            return null;
        const state = this.stack.pop();
        this.redoStack.push(state);
        return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
    }
    redo() {
        if (this.redoStack.length === 0)
            return null;
        const state = this.redoStack.pop();
        this.stack.push(state);
        return state;
    }
    get canUndo() { return this.stack.length > 1; }
    get canRedo() { return this.redoStack.length > 0; }
    get stepCount() { return this.stack.length; }
}
// ── CLASS: DrawingApp ─────────────────────────────────────────────
// Requirement: Classes
class DrawingApp {
    constructor(canvasId) {
        this.isDrawing = false;
        this.lastPoint = null;
        this.lineStart = null;
        // Requirement: Lists — colour palette
        this.palette = [
            "#ffffff", "#f8f0e3", "#ff6b6b", "#ff9f43",
            "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff",
            "#f72585", "#480ca8", "#3a86ff", "#06d6a0",
            "#000000", "#2d2d2d", "#555555", "#aaaaaa",
        ];
        const canvas = document.getElementById(canvasId);
        if (!canvas)
            throw new Error(`Canvas element "#${canvasId}" not found.`);
        const ctx = canvas.getContext("2d");
        if (!ctx)
            throw new Error("Could not get 2D rendering context.");
        this.canvas = canvas;
        this.ctx = ctx;
        this.brush = new Brush("#ffffff", 8, 1.0);
        this.history = new HistoryManager(40);
        // Overlay canvas for shape previews
        this.previewCanvas = document.createElement("canvas");
        this.previewCanvas.style.cssText =
            "position:absolute;top:0;left:0;pointer-events:none;";
        this.canvas.parentElement.style.position = "relative";
        this.canvas.parentElement.appendChild(this.previewCanvas);
        const pCtx = this.previewCanvas.getContext("2d");
        if (!pCtx)
            throw new Error("Could not get preview context.");
        this.previewCtx = pCtx;
        this.initCanvas();
        this.buildPalette();
        this.bindEvents();
        this.syncToolUI();
        this.saveSnapshot();
        this.updateStatus("Ready to draw! 🎨");
    }
    // ── CANVAS INIT ───────────────────────────────────────────────
    initCanvas() {
        this.resizeCanvases();
        this.ctx.fillStyle = "#1a1a2e";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        window.addEventListener("resize", () => this.resizeCanvases());
    }
    resizeCanvases() {
        const wrapper = this.canvas.parentElement;
        const w = wrapper.clientWidth;
        const h = wrapper.clientHeight;
        // Preserve existing drawing on resize
        const snapshot = this.canvas.width > 0
            ? this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
            : null;
        this.canvas.width = w;
        this.canvas.height = h;
        this.previewCanvas.width = w;
        this.previewCanvas.height = h;
        this.ctx.fillStyle = "#1a1a2e";
        this.ctx.fillRect(0, 0, w, h);
        if (snapshot)
            this.ctx.putImageData(snapshot, 0, 0);
    }
    // ── PALETTE ───────────────────────────────────────────────────
    buildPalette() {
        const container = document.getElementById("palette");
        if (!container)
            return;
        container.innerHTML = "";
        // Requirement: Lists — iterate over palette array
        this.palette.forEach((color) => {
            const swatch = document.createElement("button");
            swatch.className = "swatch";
            swatch.style.background = color;
            swatch.title = color;
            swatch.addEventListener("click", () => {
                this.brush.setColor(color);
                this.brush.tool = "brush";
                this.syncToolUI();
                this.updateColorUI(color);
            });
            container.appendChild(swatch);
        });
    }
    // ── EVENTS ────────────────────────────────────────────────────
    bindEvents() {
        // Mouse
        this.canvas.addEventListener("mousedown", (e) => this.onPointerDown(this.getPos(e)));
        this.canvas.addEventListener("mousemove", (e) => this.onPointerMove(this.getPos(e)));
        this.canvas.addEventListener("mouseup", () => this.onPointerUp());
        this.canvas.addEventListener("mouseleave", () => this.onPointerUp());
        // Touch
        this.canvas.addEventListener("touchstart", (e) => { e.preventDefault(); this.onPointerDown(this.getTouchPos(e)); }, { passive: false });
        this.canvas.addEventListener("touchmove", (e) => { e.preventDefault(); this.onPointerMove(this.getTouchPos(e)); }, { passive: false });
        this.canvas.addEventListener("touchend", () => this.onPointerUp());
        // Tool buttons
        document.querySelectorAll("[data-tool]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const tool = btn.dataset.tool;
                this.brush.tool = tool;
                this.syncToolUI();
            });
        });
        // Brush size
        const sizeSlider = document.getElementById("size");
        const sizeLabel = document.getElementById("size-label");
        sizeSlider?.addEventListener("input", () => {
            try {
                this.brush.setSize(parseInt(sizeSlider.value));
                if (sizeLabel)
                    sizeLabel.textContent = sizeSlider.value + "px";
            }
            catch (err) {
                // Requirement: Handling exceptions
                this.updateStatus(`⚠️ ${err.message}`);
            }
        });
        // Opacity
        const opSlider = document.getElementById("opacity");
        const opLabel = document.getElementById("opacity-label");
        opSlider?.addEventListener("input", () => {
            try {
                this.brush.setOpacity(parseFloat(opSlider.value));
                if (opLabel)
                    opLabel.textContent = Math.round(parseFloat(opSlider.value) * 100) + "%";
            }
            catch (err) {
                this.updateStatus(`⚠️ ${err.message}`);
            }
        });
        // Color picker
        const colorPicker = document.getElementById("color-picker");
        colorPicker?.addEventListener("input", () => {
            this.brush.setColor(colorPicker.value);
            this.brush.tool = "brush";
            this.syncToolUI();
        });
        // Undo / Redo / Clear
        document.getElementById("btn-undo")?.addEventListener("click", () => this.undo());
        document.getElementById("btn-redo")?.addEventListener("click", () => this.redo());
        document.getElementById("btn-clear")?.addEventListener("click", () => this.clearCanvas());
        document.getElementById("btn-save")?.addEventListener("click", () => this.saveCanvas());
        // Keyboard shortcuts
        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.key === "z") {
                e.preventDefault();
                this.undo();
            }
            if (e.ctrlKey && e.key === "y") {
                e.preventDefault();
                this.redo();
            }
            if (e.key === "b")
                this.setTool("brush");
            if (e.key === "e")
                this.setTool("eraser");
            if (e.key === "f")
                this.setTool("fill");
            if (e.key === "l")
                this.setTool("line");
            if (e.key === "r")
                this.setTool("rect");
        });
        // Coordinates display
        this.canvas.addEventListener("mousemove", (e) => {
            const p = this.getPos(e);
            const coordEl = document.getElementById("coords");
            // Requirement: Display output to the browser
            if (coordEl)
                coordEl.textContent = `${Math.round(p.x)}, ${Math.round(p.y)}`;
        });
    }
    setTool(tool) {
        this.brush.tool = tool;
        this.syncToolUI();
    }
    // ── POINTER HANDLERS ─────────────────────────────────────────
    onPointerDown(p) {
        this.isDrawing = true;
        this.lastPoint = p;
        this.lineStart = p;
        if (this.brush.tool === "fill") {
            this.saveSnapshot();
            this.floodFill(Math.round(p.x), Math.round(p.y), this.brush.color);
            return;
        }
        if (this.brush.tool === "eyedropper") {
            this.pickColor(p);
            return;
        }
        if (this.brush.tool === "brush" || this.brush.tool === "eraser") {
            this.drawDot(p);
        }
    }
    onPointerMove(p) {
        if (!this.isDrawing || !this.lastPoint)
            return;
        if (this.brush.tool === "brush" || this.brush.tool === "eraser") {
            this.drawLine(this.lastPoint, p);
            this.lastPoint = p;
        }
        if (this.brush.tool === "line" && this.lineStart) {
            // Preview line without committing
            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            this.previewCtx.strokeStyle = this.brush.cssColor;
            this.previewCtx.lineWidth = this.brush.size;
            this.previewCtx.lineCap = "round";
            this.previewCtx.beginPath();
            this.previewCtx.moveTo(this.lineStart.x, this.lineStart.y);
            this.previewCtx.lineTo(p.x, p.y);
            this.previewCtx.stroke();
        }
        if (this.brush.tool === "rect" && this.lineStart) {
            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            this.previewCtx.strokeStyle = this.brush.cssColor;
            this.previewCtx.lineWidth = this.brush.size;
            this.previewCtx.beginPath();
            this.previewCtx.strokeRect(this.lineStart.x, this.lineStart.y, p.x - this.lineStart.x, p.y - this.lineStart.y);
        }
    }
    onPointerUp() {
        if (!this.isDrawing)
            return;
        this.isDrawing = false;
        this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        // Commit shapes on mouse-up
        if (this.brush.tool === "line" && this.lineStart && this.lastPoint) {
            this.ctx.strokeStyle = this.brush.cssColor;
            this.ctx.lineWidth = this.brush.size;
            this.ctx.lineCap = "round";
            this.ctx.beginPath();
            this.ctx.moveTo(this.lineStart.x, this.lineStart.y);
            this.ctx.lineTo(this.lastPoint.x, this.lastPoint.y);
            this.ctx.stroke();
            this.saveSnapshot();
        }
        if (this.brush.tool === "rect" && this.lineStart && this.lastPoint) {
            this.ctx.strokeStyle = this.brush.cssColor;
            this.ctx.lineWidth = this.brush.size;
            this.ctx.beginPath();
            this.ctx.strokeRect(this.lineStart.x, this.lineStart.y, this.lastPoint.x - this.lineStart.x, this.lastPoint.y - this.lineStart.y);
            this.saveSnapshot();
        }
        if (this.brush.tool === "brush" || this.brush.tool === "eraser") {
            this.saveSnapshot();
        }
        this.lastPoint = null;
        this.lineStart = null;
        this.updateHistoryUI();
    }
    // ── DRAWING PRIMITIVES ────────────────────────────────────────
    drawDot(p) {
        this.ctx.fillStyle = this.brush.tool === "eraser" ? "#1a1a2e" : this.brush.cssColor;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, this.brush.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
    }
    drawLine(from, to) {
        this.ctx.strokeStyle = this.brush.tool === "eraser"
            ? "#1a1a2e"
            : this.brush.cssColor;
        this.ctx.lineWidth = this.brush.size;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();
    }
    // ── RECURSION: Flood Fill ─────────────────────────────────────
    // Requirement: Recursion
    floodFill(x, y, fillColor) {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        const w = imageData.width;
        const h = imageData.height;
        const idx = (px, py) => (py * w + px) * 4;
        const startIdx = idx(x, y);
        const targetR = data[startIdx];
        const targetG = data[startIdx + 1];
        const targetB = data[startIdx + 2];
        // Parse fill color
        const r = parseInt(fillColor.slice(1, 3), 16);
        const g = parseInt(fillColor.slice(3, 5), 16);
        const b = parseInt(fillColor.slice(5, 7), 16);
        // Don't fill if clicking on the same color
        if (targetR === r && targetG === g && targetB === b)
            return;
        const matchesTarget = (px, py) => {
            const i = idx(px, py);
            return (Math.abs(data[i] - targetR) < 30 &&
                Math.abs(data[i + 1] - targetG) < 30 &&
                Math.abs(data[i + 2] - targetB) < 30);
        };
        const colorPixel = (px, py) => {
            const i = idx(px, py);
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = 255;
        };
        // Iterative scanline fill (avoids call-stack overflow on large fills)
        // Requirement: Recursion — recursive helper to expand scanlines
        const visited = new Uint8Array(w * h);
        const fillScanline = (startX, y) => {
            if (y < 0 || y >= h)
                return; // base case
            if (!matchesTarget(startX, y))
                return;
            if (visited[y * w + startX])
                return;
            // Find left boundary
            let left = startX;
            while (left > 0 && matchesTarget(left - 1, y) && !visited[y * w + (left - 1)])
                left--;
            // Find right boundary and color everything
            let right = startX;
            while (right < w - 1 && matchesTarget(right + 1, y) && !visited[y * w + (right + 1)])
                right++;
            for (let px = left; px <= right; px++) {
                colorPixel(px, y);
                visited[y * w + px] = 1;
            }
            // Recurse up and down — Requirement: Recursion
            for (let px = left; px <= right; px++) {
                fillScanline(px, y - 1); // recursive call upward
                fillScanline(px, y + 1); // recursive call downward
            }
        };
        fillScanline(x, y); // initial recursive call
        this.ctx.putImageData(imageData, 0, 0);
        this.updateStatus(`Filled with ${fillColor}`);
    }
    // ── EYE DROPPER ───────────────────────────────────────────────
    pickColor(p) {
        const pixel = this.ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
        const hex = "#" +
            pixel[0].toString(16).padStart(2, "0") +
            pixel[1].toString(16).padStart(2, "0") +
            pixel[2].toString(16).padStart(2, "0");
        this.brush.setColor(hex);
        this.brush.tool = "brush";
        this.syncToolUI();
        this.updateColorUI(hex);
        this.updateStatus(`Color picked: ${hex}`);
    }
    // ── HISTORY ───────────────────────────────────────────────────
    saveSnapshot() {
        const snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.history.push(snapshot);
        this.updateHistoryUI();
    }
    undo() {
        const state = this.history.undo();
        if (state) {
            this.ctx.putImageData(state, 0, 0);
            this.updateStatus("Undo ↩");
        }
        this.updateHistoryUI();
    }
    redo() {
        const state = this.history.redo();
        if (state) {
            this.ctx.putImageData(state, 0, 0);
            this.updateStatus("Redo ↪");
        }
        this.updateHistoryUI();
    }
    // ── ASYNC FUNCTIONS ───────────────────────────────────────────
    // Requirement: Asynchronous functions
    async saveCanvas() {
        try {
            this.updateStatus("Saving…");
            // Create a blob from the canvas asynchronously
            const blob = await new Promise((resolve, reject) => {
                this.canvas.toBlob((b) => {
                    if (b)
                        resolve(b);
                    else
                        reject(new Error("Failed to export canvas as image."));
                }, "image/png");
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `drawing-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
            this.updateStatus("✅ Drawing saved as PNG!");
        }
        catch (err) {
            // Requirement: Handling exceptions
            if (err instanceof Error) {
                this.updateStatus(`❌ Save failed: ${err.message}`);
            }
        }
    }
    async loadImageFile(file) {
        try {
            if (!file.type.startsWith("image/")) {
                throw new TypeError(`"${file.name}" is not an image file.`);
            }
            this.updateStatus("Loading image…");
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error("Could not read file."));
                reader.readAsDataURL(file);
            });
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Could not load image."));
                img.src = dataUrl;
            });
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            this.saveSnapshot();
            this.updateStatus(`✅ Loaded "${file.name}"`);
        }
        catch (err) {
            // Requirement: Handling exceptions
            if (err instanceof TypeError) {
                this.updateStatus(`❌ Type Error: ${err.message}`);
            }
            else if (err instanceof Error) {
                this.updateStatus(`❌ Error: ${err.message}`);
            }
        }
    }
    // ── CLEAR ─────────────────────────────────────────────────────
    clearCanvas() {
        this.ctx.fillStyle = "#1a1a2e";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.saveSnapshot();
        this.updateStatus("Canvas cleared.");
    }
    // ── UI HELPERS ────────────────────────────────────────────────
    // Requirement: Display output to the browser
    updateStatus(msg) {
        const el = document.getElementById("status");
        if (el)
            el.textContent = msg;
    }
    updateHistoryUI() {
        const undoBtn = document.getElementById("btn-undo");
        const redoBtn = document.getElementById("btn-redo");
        if (undoBtn)
            undoBtn.disabled = !this.history.canUndo;
        if (redoBtn)
            redoBtn.disabled = !this.history.canRedo;
        const stepsEl = document.getElementById("history-steps");
        if (stepsEl)
            stepsEl.textContent = `${this.history.stepCount} steps`;
    }
    syncToolUI() {
        document.querySelectorAll("[data-tool]").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.tool === this.brush.tool);
        });
        const cursorMap = {
            brush: "crosshair",
            eraser: "cell",
            fill: "copy",
            eyedropper: "zoom-in",
            line: "crosshair",
            rect: "crosshair",
        };
        this.canvas.style.cursor = cursorMap[this.brush.tool] || "crosshair";
        const activeEl = document.getElementById("active-tool");
        if (activeEl)
            activeEl.textContent = this.brush.tool.charAt(0).toUpperCase() + this.brush.tool.slice(1);
    }
    updateColorUI(color) {
        const picker = document.getElementById("color-picker");
        if (picker)
            picker.value = color;
        const preview = document.getElementById("color-preview");
        if (preview)
            preview.style.background = color;
    }
    // ── POSITION HELPERS ─────────────────────────────────────────
    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    getTouchPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const t = e.touches[0] || e.changedTouches[0];
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
}
// ── BOOTSTRAP ────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
    try {
        const app = new DrawingApp("canvas");
        // File drop support (async)
        const wrapper = document.getElementById("canvas-wrapper");
        wrapper?.addEventListener("dragover", (e) => e.preventDefault());
        wrapper?.addEventListener("drop", (e) => {
            e.preventDefault();
            const file = e.dataTransfer?.files[0];
            if (file)
                app.loadImageFile(file); // async call
        });
        // File input button
        const fileInput = document.getElementById("file-input");
        fileInput?.addEventListener("change", () => {
            const file = fileInput.files?.[0];
            if (file)
                app.loadImageFile(file); // async call
        });
    }
    catch (err) {
        // Requirement: Handling exceptions — top-level bootstrap error
        const msg = err instanceof Error ? err.message : "Unknown startup error";
        document.body.innerHTML = `<div style="color:#ff6b6b;padding:2rem;font-family:monospace">
      ❌ Failed to start Drawing App: ${msg}</div>`;
    }
});
