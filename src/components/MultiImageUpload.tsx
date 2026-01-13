import React, { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Image as ImageIcon, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';

export interface ImageFile {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: number;
  uploadedAt: Date;
  description?: string;
  bodyPart?: string;
}

interface MultiImageUploadProps {
  images: ImageFile[];
  onImagesChange: (images: ImageFile[]) => void;
  maxImages?: number;
  maxFileSizeMB?: number;
  acceptedTypes?: string[];
  label?: string;
  bodyPartOptions?: string[];
  showDescriptions?: boolean;
  className?: string;
}

export const MultiImageUpload: React.FC<MultiImageUploadProps> = ({
  images,
  onImagesChange,
  maxImages = 10,
  maxFileSizeMB = 5,
  acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  label = 'Clinical Photographs',
  bodyPartOptions = [
    'Face - Frontal',
    'Face - Left Profile',
    'Face - Right Profile',
    'Face - Three-Quarter',
    'Nose - Frontal',
    'Nose - Basal',
    'Nose - Profile',
    'Breast - Frontal',
    'Breast - Oblique Left',
    'Breast - Oblique Right',
    'Breast - Lateral',
    'Abdomen - Frontal',
    'Abdomen - Profile',
    'Upper Limb',
    'Lower Limb',
    'Back',
    'Hand',
    'Wound/Lesion',
    'Pre-operative',
    'Intra-operative',
    'Post-operative',
    'Other',
  ],
  showDescriptions = true,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImageFile | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `Invalid file type: ${file.type}. Accepted types: ${acceptedTypes.join(', ')}`;
    }
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      return `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum: ${maxFileSizeMB}MB`;
    }
    return null;
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    
    if (images.length + fileArray.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed. You can add ${maxImages - images.length} more.`);
      return;
    }

    const newImages: ImageFile[] = [];

    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }

      // Create preview URL
      const preview = URL.createObjectURL(file);
      
      newImages.push({
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview,
        name: file.name,
        size: file.size,
        uploadedAt: new Date(),
        description: '',
        bodyPart: '',
      });
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }
  }, [images, maxImages, acceptedTypes, maxFileSizeMB, onImagesChange]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = ''; // Reset to allow selecting same file again
    }
  };

  const removeImage = (id: string) => {
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    onImagesChange(images.filter(img => img.id !== id));
  };

  const updateImageDetails = (id: string, updates: Partial<ImageFile>) => {
    onImagesChange(images.map(img => 
      img.id === id ? { ...img, ...updates } : img
    ));
  };

  const openPreview = (image: ImageFile, index: number) => {
    setPreviewImage(image);
    setPreviewIndex(index);
  };

  const navigatePreview = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? (previewIndex - 1 + images.length) % images.length
      : (previewIndex + 1) % images.length;
    setPreviewIndex(newIndex);
    setPreviewImage(images[newIndex]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label} ({images.length}/{maxImages})
      </label>

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${images.length >= maxImages ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              disabled={images.length >= maxImages}
            >
              <Upload className="w-5 h-5" />
              Browse Files
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled={images.length >= maxImages}
            >
              <Camera className="w-5 h-5" />
              Take Photo
            </button>
          </div>
          
          <p className="text-sm text-gray-500">
            or drag and drop images here
          </p>
          
          <p className="text-xs text-gray-400">
            Accepted formats: JPEG, PNG, WebP, HEIC • Max size: {maxFileSizeMB}MB each
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="relative group border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              {/* Image Preview */}
              <div className="aspect-square relative">
                <img
                  src={image.preview}
                  alt={image.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openPreview(image, index)}
                    className="p-2 bg-white rounded-full mr-2 hover:bg-gray-100"
                    title="Preview"
                  >
                    <ZoomIn className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    className="p-2 bg-red-500 rounded-full hover:bg-red-600"
                    title="Remove"
                  >
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Image Details */}
              {showDescriptions && (
                <div className="p-2 space-y-2">
                  <select
                    value={image.bodyPart || ''}
                    onChange={(e) => updateImageDetails(image.id, { bodyPart: e.target.value })}
                    className="w-full text-xs px-2 py-1 border border-gray-300 rounded"
                  >
                    <option value="">Select body part...</option>
                    {bodyPartOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={image.description || ''}
                    onChange={(e) => updateImageDetails(image.id, { description: e.target.value })}
                    placeholder="Description..."
                    className="w-full text-xs px-2 py-1 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-400">{formatFileSize(image.size)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full-screen Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full"
          >
            <X className="w-8 h-8" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => navigatePreview('prev')}
                className="absolute left-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                type="button"
                onClick={() => navigatePreview('next')}
                className="absolute right-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-full"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-[90vh] p-4">
            <img
              src={previewImage.preview}
              alt={previewImage.name}
              className="max-w-full max-h-[80vh] object-contain"
            />
            <div className="mt-4 text-center text-white">
              <p className="font-medium">{previewImage.bodyPart || previewImage.name}</p>
              {previewImage.description && (
                <p className="text-sm text-gray-300">{previewImage.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {previewIndex + 1} of {images.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiImageUpload;
