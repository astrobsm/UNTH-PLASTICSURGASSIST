import { useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ZoomIn, Calendar } from 'lucide-react';
import { ClinicalPhotograph } from '../../services/preSurgicalConferenceService';

interface Props {
  photographs: ClinicalPhotograph[];
}

export default function ClinicalPhotographsSlide({ photographs }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const handlePrev = () => setSelectedIndex(prev => (prev > 0 ? prev - 1 : photographs.length - 1));
  const handleNext = () => setSelectedIndex(prev => (prev < photographs.length - 1 ? prev + 1 : 0));

  if (photographs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Camera className="h-24 w-24 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-400">No Clinical Photographs</h2>
        <p className="text-gray-500 mt-2">No clinical photographs have been uploaded for this patient</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Camera className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold">Clinical Photographs</h1>
        <p className="text-gray-400 mt-2">{photographs.length} photograph(s) on record</p>
      </div>

      {/* Main Image Display */}
      <div className="bg-black rounded-2xl overflow-hidden relative">
        <div 
          className={`flex items-center justify-center ${isZoomed ? 'h-[60vh]' : 'h-[45vh]'} transition-all cursor-pointer`}
          onClick={() => setIsZoomed(!isZoomed)}
        >
          <img
            src={photographs[selectedIndex]?.url}
            alt={photographs[selectedIndex]?.caption}
            className="max-h-full max-w-full object-contain p-4 transition-all"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzZiNzI4MCIgZm9udC1zaXplPSIxNCI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
            }}
          />
        </div>

        {/* Navigation arrows */}
        {photographs.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              title="Previous photo"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              title="Next photo"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </>
        )}

        {/* Image info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-lg font-semibold">{photographs[selectedIndex]?.caption || 'Clinical photograph'}</p>
              <div className="flex items-center space-x-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-300" />
                <span className="text-gray-300 text-sm">
                  {photographs[selectedIndex]?.date 
                    ? new Date(photographs[selectedIndex].date).toLocaleDateString()
                    : 'Date not available'}
                </span>
                <span className="text-gray-400 text-sm ml-2">
                  Type: {photographs[selectedIndex]?.type || 'clinical'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <ZoomIn className="h-5 w-5 text-gray-300" />
              <span className="text-gray-300 text-sm">Click to {isZoomed ? 'minimize' : 'zoom'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnail Strip */}
      {photographs.length > 1 && (
        <div className="flex space-x-3 overflow-x-auto pb-2 justify-center">
          {photographs.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setSelectedIndex(index)}
              title={photo.caption || `Photo ${index + 1}`}
              className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                index === selectedIndex 
                  ? 'border-purple-500 ring-2 ring-purple-500' 
                  : 'border-gray-600 opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={photo.url}
                alt={photo.caption}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2U1ZTdlYiIvPjwvc3ZnPg==';
                }}
              />
            </button>
          ))}
        </div>
      )}

      <div className="text-center">
        <span className="text-gray-400 text-lg">
          {selectedIndex + 1} of {photographs.length} photographs
        </span>
      </div>
    </div>
  );
}
