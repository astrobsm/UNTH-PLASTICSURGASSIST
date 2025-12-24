/**
 * Presentation Service
 * Handles slide presentations with interactive controls for video conferences
 */

export interface Slide {
  id: string;
  type: 'image' | 'text' | 'video' | 'pdf' | 'whiteboard';
  content: string;
  title?: string;
  notes?: string;
  annotations?: Annotation[];
  order: number;
}

export interface Annotation {
  id: string;
  type: 'pen' | 'highlighter' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'pointer';
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
  text?: string;
  createdBy: string;
  createdAt: Date;
}

export interface Presentation {
  id: string;
  title: string;
  slides: Slide[];
  currentSlideIndex: number;
  ownerId: string;
  ownerName: string;
  isLive: boolean;
  allowAnnotations: boolean;
  allowQuestions: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PresentationState {
  currentSlide: number;
  annotations: Annotation[];
  pointerPosition: { x: number; y: number } | null;
  zoomLevel: number;
  isFullscreen: boolean;
}

export interface Question {
  id: string;
  userId: string;
  userName: string;
  question: string;
  timestamp: Date;
  isAnswered: boolean;
  upvotes: number;
  upvotedBy: string[];
}

type EventCallback = (...args: any[]) => void;

class PresentationService {
  private currentPresentation: Presentation | null = null;
  private presentationState: PresentationState = {
    currentSlide: 0,
    annotations: [],
    pointerPosition: null,
    zoomLevel: 1,
    isFullscreen: false,
  };
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private isPresenter: boolean = false;
  private questions: Question[] = [];
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing: boolean = false;
  private currentTool: Annotation['type'] = 'pen';
  private currentColor: string = '#FF0000';
  private currentStrokeWidth: number = 3;
  private currentAnnotation: Annotation | null = null;

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners() {
    ['slide-changed', 'annotation-added', 'annotation-removed', 
     'pointer-moved', 'zoom-changed', 'fullscreen-changed',
     'question-added', 'question-answered', 'presentation-ended',
     'state-sync', 'error'].forEach(event => {
      this.eventListeners.set(event, new Set());
    });
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: any) {
    this.eventListeners.get(event)?.forEach(callback => callback(data));
  }

  /**
   * Create a new presentation from files
   */
  async createPresentation(
    title: string,
    files: File[],
    ownerId: string,
    ownerName: string
  ): Promise<Presentation> {
    const slides: Slide[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const slide = await this.createSlideFromFile(file, i);
      slides.push(slide);
    }

    const presentation: Presentation = {
      id: `pres-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      slides,
      currentSlideIndex: 0,
      ownerId,
      ownerName,
      isLive: false,
      allowAnnotations: true,
      allowQuestions: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.currentPresentation = presentation;
    return presentation;
  }

  /**
   * Create slide from file
   */
  private async createSlideFromFile(file: File, order: number): Promise<Slide> {
    const content = await this.fileToDataUrl(file);
    
    let type: Slide['type'] = 'image';
    if (file.type === 'application/pdf') {
      type = 'pdf';
    } else if (file.type.startsWith('video/')) {
      type = 'video';
    }

    return {
      id: `slide-${Date.now()}-${order}`,
      type,
      content,
      title: file.name.replace(/\.[^/.]+$/, ''),
      annotations: [],
      order,
    };
  }

  /**
   * Convert file to data URL
   */
  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  }

  /**
   * Add a text/whiteboard slide
   */
  addSlide(type: 'text' | 'whiteboard', content: string = '', title?: string): Slide {
    if (!this.currentPresentation) {
      throw new Error('No active presentation');
    }

    const slide: Slide = {
      id: `slide-${Date.now()}`,
      type,
      content,
      title,
      annotations: [],
      order: this.currentPresentation.slides.length,
    };

    this.currentPresentation.slides.push(slide);
    this.currentPresentation.updatedAt = new Date();
    return slide;
  }

  /**
   * Remove a slide
   */
  removeSlide(slideId: string): boolean {
    if (!this.currentPresentation) return false;

    const index = this.currentPresentation.slides.findIndex(s => s.id === slideId);
    if (index !== -1) {
      this.currentPresentation.slides.splice(index, 1);
      // Reorder slides
      this.currentPresentation.slides.forEach((s, i) => s.order = i);
      this.currentPresentation.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Reorder slides
   */
  reorderSlides(fromIndex: number, toIndex: number): void {
    if (!this.currentPresentation) return;

    const slides = this.currentPresentation.slides;
    const [removed] = slides.splice(fromIndex, 1);
    slides.splice(toIndex, 0, removed);
    slides.forEach((s, i) => s.order = i);
    this.currentPresentation.updatedAt = new Date();
  }

  /**
   * Start presenting
   */
  startPresentation(presentation?: Presentation): void {
    if (presentation) {
      this.currentPresentation = presentation;
    }
    
    if (!this.currentPresentation) {
      throw new Error('No presentation to start');
    }

    this.isPresenter = true;
    this.currentPresentation.isLive = true;
    this.presentationState.currentSlide = 0;
    this.emit('state-sync', this.getState());
  }

  /**
   * Join a presentation as viewer
   */
  joinPresentation(presentation: Presentation): void {
    this.currentPresentation = presentation;
    this.isPresenter = false;
    this.emit('state-sync', this.getState());
  }

  /**
   * End presentation
   */
  endPresentation(): void {
    if (this.currentPresentation) {
      this.currentPresentation.isLive = false;
    }
    this.isPresenter = false;
    this.questions = [];
    this.emit('presentation-ended', null);
  }

  /**
   * Navigate to next slide
   */
  nextSlide(): void {
    if (!this.currentPresentation) return;
    
    if (this.presentationState.currentSlide < this.currentPresentation.slides.length - 1) {
      this.presentationState.currentSlide++;
      this.presentationState.annotations = [];
      this.emit('slide-changed', this.presentationState.currentSlide);
    }
  }

  /**
   * Navigate to previous slide
   */
  previousSlide(): void {
    if (this.presentationState.currentSlide > 0) {
      this.presentationState.currentSlide--;
      this.presentationState.annotations = [];
      this.emit('slide-changed', this.presentationState.currentSlide);
    }
  }

  /**
   * Go to specific slide
   */
  goToSlide(index: number): void {
    if (!this.currentPresentation) return;
    
    if (index >= 0 && index < this.currentPresentation.slides.length) {
      this.presentationState.currentSlide = index;
      this.presentationState.annotations = [];
      this.emit('slide-changed', index);
    }
  }

  /**
   * Set drawing canvas
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.setupCanvasEvents();
  }

  /**
   * Setup canvas events for drawing
   */
  private setupCanvasEvents(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleMouseUp.bind(this));
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.canvas) return;
    
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    this.currentAnnotation = {
      id: `ann-${Date.now()}`,
      type: this.currentTool,
      color: this.currentColor,
      strokeWidth: this.currentStrokeWidth,
      points: [{ x, y }],
      createdBy: '',
      createdAt: new Date(),
    };
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Update pointer position
    if (this.currentTool === 'pointer') {
      this.updatePointerPosition(x, y);
      return;
    }

    if (!this.isDrawing || !this.currentAnnotation) return;

    this.currentAnnotation.points.push({ x, y });
    this.redrawAnnotations();
  }

  private handleMouseUp(): void {
    if (this.isDrawing && this.currentAnnotation) {
      this.presentationState.annotations.push(this.currentAnnotation);
      this.emit('annotation-added', this.currentAnnotation);
      this.currentAnnotation = null;
    }
    this.isDrawing = false;
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (!this.canvas || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;

    this.isDrawing = true;
    this.currentAnnotation = {
      id: `ann-${Date.now()}`,
      type: this.currentTool,
      color: this.currentColor,
      strokeWidth: this.currentStrokeWidth,
      points: [{ x, y }],
      createdBy: '',
      createdAt: new Date(),
    };
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.canvas || !this.isDrawing || !this.currentAnnotation || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;

    this.currentAnnotation.points.push({ x, y });
    this.redrawAnnotations();
  }

  /**
   * Redraw all annotations
   */
  private redrawAnnotations(): void {
    if (!this.ctx || !this.canvas) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw all annotations
    [...this.presentationState.annotations, this.currentAnnotation]
      .filter(Boolean)
      .forEach(ann => this.drawAnnotation(ann!));
  }

  /**
   * Draw a single annotation
   */
  private drawAnnotation(annotation: Annotation): void {
    if (!this.ctx || !this.canvas || annotation.points.length < 1) return;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = annotation.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (annotation.type === 'highlighter') {
      ctx.globalAlpha = 0.3;
    } else {
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    const firstPoint = annotation.points[0];
    ctx.moveTo(firstPoint.x * width, firstPoint.y * height);

    for (let i = 1; i < annotation.points.length; i++) {
      const point = annotation.points[i];
      ctx.lineTo(point.x * width, point.y * height);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * Set annotation tool
   */
  setTool(tool: Annotation['type']): void {
    this.currentTool = tool;
  }

  /**
   * Set annotation color
   */
  setColor(color: string): void {
    this.currentColor = color;
  }

  /**
   * Set stroke width
   */
  setStrokeWidth(width: number): void {
    this.currentStrokeWidth = width;
  }

  /**
   * Clear all annotations on current slide
   */
  clearAnnotations(): void {
    this.presentationState.annotations = [];
    this.redrawAnnotations();
    this.emit('annotation-removed', null);
  }

  /**
   * Undo last annotation
   */
  undoAnnotation(): Annotation | undefined {
    const annotation = this.presentationState.annotations.pop();
    this.redrawAnnotations();
    return annotation;
  }

  /**
   * Update pointer position
   */
  updatePointerPosition(x: number, y: number): void {
    this.presentationState.pointerPosition = { x, y };
    this.emit('pointer-moved', { x, y });
  }

  /**
   * Hide pointer
   */
  hidePointer(): void {
    this.presentationState.pointerPosition = null;
    this.emit('pointer-moved', null);
  }

  /**
   * Set zoom level
   */
  setZoom(level: number): void {
    this.presentationState.zoomLevel = Math.max(0.5, Math.min(3, level));
    this.emit('zoom-changed', this.presentationState.zoomLevel);
  }

  /**
   * Toggle fullscreen
   */
  async toggleFullscreen(): Promise<void> {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      this.presentationState.isFullscreen = true;
    } else {
      await document.exitFullscreen();
      this.presentationState.isFullscreen = false;
    }
    this.emit('fullscreen-changed', this.presentationState.isFullscreen);
  }

  /**
   * Add a question
   */
  addQuestion(userId: string, userName: string, question: string): Question {
    const q: Question = {
      id: `q-${Date.now()}`,
      userId,
      userName,
      question,
      timestamp: new Date(),
      isAnswered: false,
      upvotes: 0,
      upvotedBy: [],
    };
    this.questions.push(q);
    this.emit('question-added', q);
    return q;
  }

  /**
   * Upvote a question
   */
  upvoteQuestion(questionId: string, userId: string): void {
    const question = this.questions.find(q => q.id === questionId);
    if (question && !question.upvotedBy.includes(userId)) {
      question.upvotes++;
      question.upvotedBy.push(userId);
    }
  }

  /**
   * Mark question as answered
   */
  markQuestionAnswered(questionId: string): void {
    const question = this.questions.find(q => q.id === questionId);
    if (question) {
      question.isAnswered = true;
      this.emit('question-answered', question);
    }
  }

  /**
   * Get all questions
   */
  getQuestions(): Question[] {
    return [...this.questions].sort((a, b) => b.upvotes - a.upvotes);
  }

  /**
   * Get current slide
   */
  getCurrentSlide(): Slide | null {
    if (!this.currentPresentation) return null;
    return this.currentPresentation.slides[this.presentationState.currentSlide] || null;
  }

  /**
   * Get presentation state
   */
  getState(): { presentation: Presentation | null; state: PresentationState } {
    return {
      presentation: this.currentPresentation,
      state: { ...this.presentationState },
    };
  }

  /**
   * Get current presentation
   */
  getPresentation(): Presentation | null {
    return this.currentPresentation;
  }

  /**
   * Check if current user is presenter
   */
  getIsPresenter(): boolean {
    return this.isPresenter;
  }

  /**
   * Sync state from presenter
   */
  syncState(state: PresentationState): void {
    this.presentationState = { ...state };
    this.redrawAnnotations();
    this.emit('state-sync', this.getState());
  }

  /**
   * Export presentation as PDF (slides only)
   */
  async exportToPdf(): Promise<Blob | null> {
    // This would require a PDF library like jsPDF
    console.log('PDF export not implemented');
    return null;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.currentPresentation = null;
    this.presentationState = {
      currentSlide: 0,
      annotations: [],
      pointerPosition: null,
      zoomLevel: 1,
      isFullscreen: false,
    };
    this.questions = [];
    this.canvas = null;
    this.ctx = null;
  }
}

export const presentationService = new PresentationService();
export default presentationService;
