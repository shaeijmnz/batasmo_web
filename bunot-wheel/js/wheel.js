const SEGMENT_COLORS = ['#56ab2f', '#f9d423', '#e53935', '#1e88e5'];

export class Wheel {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.frame = canvas.parentElement;
    this.area = this.frame?.parentElement;
    this.section = this.area?.parentElement;
    this.names = [];
    this.rotation = 0;
    this.isSpinning = false;
    this.animationId = null;
    this.size = 600;
    this.dpr = window.devicePixelRatio || 1;
    this.pointerReserve = 40;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      if (this.area) this.resizeObserver.observe(this.area);
      if (this.section) this.resizeObserver.observe(this.section);
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => this.resize()));
    }
  }

  getAvailableSize() {
    const header = document.querySelector('.topbar');
    const headerHeight = header?.offsetHeight ?? 52;
    const pad = 12;

    let availW = (this.area?.clientWidth ?? 0) - pad - this.pointerReserve;
    let availH = (this.area?.clientHeight ?? 0) - pad;

    if (availW < 240 || availH < 240) {
      const sectionW = this.section?.clientWidth ?? window.innerWidth;
      const viewportH = window.innerHeight - headerHeight;
      availW = Math.max(availW, sectionW - pad - this.pointerReserve);
      availH = Math.max(availH, viewportH - pad);
    }

    return Math.max(320, Math.min(availW, availH));
  }

  resize() {
    this.size = this.getAvailableSize();
    this.canvas.width = this.size * this.dpr;
    this.canvas.height = this.size * this.dpr;
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
  }

  setNames(names) {
    this.names = names.slice();
    this.draw();
  }

  getSegmentColor(index) {
    return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
  }

  getSegmentCenterAngle(index, total) {
    const slice = (Math.PI * 2) / total;
    return -Math.PI / 2 + (index + 0.5) * slice;
  }

  rotationForIndex(index, total, extraTurns = 0) {
    const center = this.getSegmentCenterAngle(index, total);
    return -center + extraTurns * Math.PI * 2;
  }

  computeForwardDelta(targetIndex, total, startRotation) {
    const twoPi = Math.PI * 2;
    const landAngle = this.rotationForIndex(targetIndex, total, 0);
    const current = ((startRotation % twoPi) + twoPi) % twoPi;
    let align = (landAngle - current + twoPi) % twoPi;
    if (align < 0.001) align = twoPi;
    return twoPi + align;
  }

  // Isang ikot, maikling slowmo sa dulo.
  suspenseEase(t) {
    if (t <= 0.4) {
      return (t / 0.4) * 0.88;
    }
    const p = (t - 0.4) / 0.6;
    return 0.88 + 0.12 * (1 - (1 - p) ** 5);
  }

  draw() {
    const { ctx, size, names, rotation } = this;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;
    const total = names.length;

    ctx.clearRect(0, 0, size, size);

    if (total === 0) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#e8eef5';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      return;
    }

    const slice = (Math.PI * 2) / total;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < total; i += 1) {
      const start = -Math.PI / 2 + i * slice;
      const end = start + slice;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = this.getSegmentColor(i);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = total > 50 ? 0.5 : 1.5;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + slice / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#111';
      const fontSize = Math.max(6, Math.min(14, radius / Math.max(total * 0.45, 8)));
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const label = this.truncateLabel(names[i], total);
      ctx.fillText(label, radius - 10, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    const hubRadius = Math.max(22, radius * 0.08);
    ctx.beginPath();
    ctx.arc(0, 0, hubRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#d0d7de';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  truncateLabel(name, total) {
    const text = String(name || '').trim();
    if (total <= 30) return text.slice(0, 24);
    if (total <= 60) return text.slice(0, 12);
    return text.slice(0, 8);
  }

  cancelAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  spinToIndex(targetIndex, onComplete) {
    if (this.isSpinning || this.names.length === 0) return;
    const total = this.names.length;
    const safeIndex = Math.max(0, Math.min(targetIndex, total - 1));

    const startRotation = this.rotation;
    const delta = this.computeForwardDelta(safeIndex, total, startRotation);
    const duration = 4800 + Math.random() * 600;
    const startTime = performance.now();

    this.isSpinning = true;
    this.cancelAnimation();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      this.rotation = startRotation + delta * this.suspenseEase(progress);
      this.draw();

      if (progress < 1) {
        this.animationId = requestAnimationFrame(tick);
        return;
      }

      this.rotation = startRotation + delta;
      this.draw();
      this.isSpinning = false;
      this.animationId = null;
      if (onComplete) onComplete(safeIndex);
    };

    this.animationId = requestAnimationFrame(tick);
  }
}
