import { ReactNode } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface SlideWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onExit: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  currentSlide: number;
  totalSlides: number;
  bgColor?: string;
}

export default function SlideWrapper({
  title,
  subtitle,
  children,
  onExit,
  onNext,
  onPrev,
  currentSlide,
  totalSlides,
  bgColor = 'bg-gray-900'
}: SlideWrapperProps) {
  return (
    <div className={`fixed inset-0 z-50 ${bgColor} text-white flex flex-col`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/30 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            {currentSlide} / {totalSlides}
          </div>
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="text-sm text-gray-300">{subtitle}</p>}
          </div>
        </div>
        <button
          onClick={onExit}
          className="p-2 rounded-full bg-red-600 hover:bg-red-700 transition-colors text-white"
          title="Exit presentation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Slide Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        {children}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/30 backdrop-blur-sm">
        <button
          onClick={onPrev}
          disabled={!onPrev}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            onPrev
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-white/5 text-gray-600 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="h-5 w-5" />
          <span>Previous</span>
        </button>

        {/* Slide dots */}
        <div className="flex space-x-2">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i + 1 === currentSlide ? 'w-6 bg-green-500' : 'w-2 bg-white/30'
              }`}
            />
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={!onNext}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            onNext
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-white/5 text-gray-600 cursor-not-allowed'
          }`}
        >
          <span>Next</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
