<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  file: {
    type: [File, Blob, Object],
    default: null,
  },
  src: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'cropped', 'cancel']);

const canvasRef = ref(null);
const containerRef = ref(null);

const image = new Image();
const imageLoaded = ref(false);
const imageUrl = ref(null);

const dragging = ref(false);
const lastPointer = ref({ x: 0, y: 0 });

const position = ref({ x: 0, y: 0 });
const scale = ref(1.2);

const minScale = ref(0.6);
const maxScale = ref(3);

const canvasSize = ref(320);

const internalOpen = ref(props.modelValue || false);

const isOpen = computed(() => internalOpen.value);

function close() {
  internalOpen.value = false;
  emit('update:modelValue', false);
}

function cancel() {
  close();
  emit('cancel');
}

function resetTransform() {
  position.value = { x: 0, y: 0 };
  scale.value = 1.2;
}

function setInitialTransform() {
  const canvas = canvasRef.value;
  if (!canvas || !image.width || !image.height) {
    resetTransform();
    return;
  }

  const size = canvasSize.value || Math.min(canvas.width, canvas.height);
  // Wir wollen den runden Bereich gut ausfüllen: Bild soll mindestens die kleinere Seite abdecken.
  const baseScale = Math.max(size / image.width, size / image.height);

  position.value = { x: 0, y: 0 };
  scale.value = baseScale;
  minScale.value = baseScale * 0.6;
  maxScale.value = baseScale * 3;
}

function loadFromFile(file) {
  if (!file) {
    imageLoaded.value = false;
    imageUrl.value = null;
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    imageUrl.value = e.target?.result || null;
    if (imageUrl.value) {
      image.onload = () => {
        imageLoaded.value = true;
        setInitialTransform();
        draw();
      };
      image.src = imageUrl.value;
    }
  };
  reader.readAsDataURL(file);
}

function loadFromSrc(src) {
  if (!src) {
    imageLoaded.value = false;
    imageUrl.value = null;
    return;
  }

  imageUrl.value = src;
  image.onload = () => {
    imageLoaded.value = true;
    setInitialTransform();
    draw();
  };
  image.src = src;
}

function loadImage() {
  imageLoaded.value = false;

  if (props.file) {
    loadFromFile(props.file);
    return;
  }

  if (props.src) {
    loadFromSrc(props.src);
    return;
  }

  imageUrl.value = null;
}

watch(
  () => props.file,
  () => {
    if (isOpen.value) {
      loadImage();
    }
  },
  { immediate: true },
);

watch(
  () => props.src,
  () => {
    if (isOpen.value) {
      loadImage();
    }
  },
  { immediate: true },
);

watch(
  () => props.modelValue,
  (open) => {
    internalOpen.value = open;
    if (open) {
      loadImage();
      requestAnimationFrame(() => {
        ensureCanvasSize();
        draw();
      });
    }
  },
);

function ensureCanvasSize() {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const rect = container.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  if (!size) return;
  const targetSize = Math.max(1, Math.floor(size));
  canvas.width = targetSize;
  canvas.height = targetSize;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvasSize.value = targetSize;
}

function draw() {
  const canvas = canvasRef.value;
  if (!canvas || !imageLoaded.value) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2 + position.value.x, height / 2 + position.value.y);
  ctx.scale(scale.value, scale.value);
  const iw = image.width;
  const ih = image.height;
  if (iw && ih) {
    ctx.drawImage(image, -iw / 2, -ih / 2);
  }
  ctx.restore();
}

function pointerDown(evt) {
  if (!imageLoaded.value) return;
  dragging.value = true;
  const point = getPoint(evt);
  lastPointer.value = point;
}

function pointerMove(evt) {
  if (!dragging.value || !imageLoaded.value) return;
  const point = getPoint(evt);
  const dx = point.x - lastPointer.value.x;
  const dy = point.y - lastPointer.value.y;
  lastPointer.value = point;
  position.value = {
    x: position.value.x + dx,
    y: position.value.y + dy,
  };
  draw();
}

function pointerUp() {
  dragging.value = false;
}

function getPoint(evt) {
  if (evt.touches && evt.touches[0]) {
    return {
      x: evt.touches[0].clientX,
      y: evt.touches[0].clientY,
    };
  }
  return {
    x: evt.clientX,
    y: evt.clientY,
  };
}

function onWheel(evt) {
  if (!imageLoaded.value) return;
  evt.preventDefault();
  const delta = -evt.deltaY || -evt.wheelDelta || evt.detail;
  const zoomStep = delta > 0 ? 0.05 : -0.05;
  const next = Math.min(maxScale.value, Math.max(minScale.value, scale.value + zoomStep));
  if (next !== scale.value) {
    scale.value = next;
    draw();
  }
}

watch(scale, () => {
  draw();
});


function handleCrop() {
  const canvas = canvasRef.value;
  if (!canvas || !imageLoaded.value) return;

  const size = canvasSize.value;
  const outCanvas = document.createElement('canvas');
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return;

  const outputSize = 400; 
  
  outCanvas.width = outputSize;
  outCanvas.height = outputSize;


  outCtx.fillStyle = '#000000';
  outCtx.fillRect(0, 0, outputSize, outputSize);


  outCtx.save();

  const ratio = outputSize / size;

  outCtx.translate(
    outputSize / 2 + position.value.x * ratio, 
    outputSize / 2 + position.value.y * ratio
  );
  
  outCtx.scale(
    scale.value * ratio, 
    scale.value * ratio
  );

  const iw = image.width;
  const ih = image.height;
  
  if (iw && ih) {
    outCtx.drawImage(image, -iw / 2, -ih / 2);
  }

  outCtx.restore();

  outCanvas.toBlob(
    (blob) => {
      if (blob) {
        emit('cropped', blob);
      }
      close();
    },
    'image/png', 
    0.95
  );
}


function onOverlayClick(evt) {
  if (evt.target === evt.currentTarget) {
    cancel();
  }
}

let resizeObserver;

onMounted(() => {
  ensureCanvasSize();
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      ensureCanvasSize();
      draw();
    });
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value);
  }
});
</script>

<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      class="avatar-cropper-overlay"
      @click="onOverlayClick"
    >
      <div class="avatar-cropper-modal">
        <h2 class="cropper-title">Profilbild zuschneiden</h2>
        <p class="cropper-subtitle">
          Ziehe das Bild, um den Ausschnitt zu verschieben, und nutze den Zoom-Regler oder das Mausrad.
        </p>

        <div
          ref="containerRef"
          class="cropper-canvas-wrapper"
        >
          <canvas
            ref="canvasRef"
            class="cropper-canvas"
            @mousedown.prevent="pointerDown"
            @mousemove.prevent="pointerMove"
            @mouseup.prevent="pointerUp"
            @mouseleave.prevent="pointerUp"
            @touchstart.prevent="pointerDown"
            @touchmove.prevent="pointerMove"
            @touchend.prevent="pointerUp"
            @wheel="onWheel"
          ></canvas>
          <div class="cropper-mask"></div>
        </div>

        <div class="cropper-controls">
          <label class="zoom-label">
            Zoom
            <input
              type="range"
              :min="minScale"
              :max="maxScale"
              step="0.01"
              v-model.number="scale"
            />
          </label>

          <div class="cropper-actions">
            <button
              type="button"
              class="btn ghost"
              @click="cancel"
            >
              Abbrechen
            </button>
            <button
              type="button"
              class="btn primary"
              :disabled="!imageLoaded"
              @click="handleCrop"
            >
              Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.avatar-cropper-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.8);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.avatar-cropper-modal {
  width: min(540px, 95vw);
  border-radius: 24px;
  padding: 1.8rem 2rem 1.7rem;
  background:
    linear-gradient(135deg, rgba(13, 9, 46, 0.98), rgba(5, 9, 24, 0.98)) padding-box,
    linear-gradient(125deg, rgba(255, 0, 200, 0.8), rgba(5, 217, 255, 0.7)) border-box;
  border: 1px solid transparent;
  box-shadow:
    0 18px 40px rgba(5, 217, 255, 0.25),
    0 12px 32px rgba(255, 0, 200, 0.3);
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  color: #f6f9ff;
}

.cropper-title {
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.95);
}

.cropper-subtitle {
  font-size: 0.9rem;
  color: rgba(234, 238, 255, 0.78);
}

.cropper-canvas-wrapper {
  position: relative;
  margin-top: 0.4rem;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 22px;
  background: #000000ff;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

.cropper-canvas {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
  cursor: grab;
}

.cropper-canvas:active {
  cursor: grabbing;
}

.cropper-mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      circle at center,
      transparent 0,
      transparent 40%,
      rgba(5, 6, 20, 0.78) 42%,
      rgba(5, 6, 20, 0.96) 100%
    );
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.cropper-controls {
  margin-top: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.zoom-label {
  font-size: 0.82rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(234, 238, 255, 0.78);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.zoom-label input[type='range'] {
  flex: 1;
}

.cropper-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.02);
  color: #ffffff;
  padding: 0.55rem 1.4rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition:
    transform 0.22s ease,
    box-shadow 0.25s ease,
    background 0.25s ease,
    border-color 0.25s ease;
  text-decoration: none;
}

.btn.primary {
  border: none;
  background: var(--gradient-accent);
  box-shadow: 0 10px 28px rgba(255, 0, 200, 0.25);
  color: #050505;
}

.btn.ghost {
  background: rgba(255, 255, 255, 0.03);
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    0 0 16px rgba(255, 0, 200, 0.45),
    0 0 26px rgba(5, 217, 255, 0.45);
  border-color: rgba(255, 255, 255, 0.4);
}

.btn.primary:hover:not(:disabled) {
  box-shadow:
    0 0 18px rgba(255, 0, 200, 0.65),
    0 0 32px rgba(5, 217, 255, 0.6);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
  box-shadow: none;
}

@media (max-width: 640px) {
  .avatar-cropper-modal {
    padding: 1.5rem 1.4rem 1.4rem;
  }

  .cropper-title {
    font-size: 1.05rem;
  }

  .cropper-subtitle {
    font-size: 0.85rem;
  }
}
</style>
