/**
 * ProfessionalSlider - Slider personalizado con estilo de DAW profesional
 */

import React, { useState, useRef, useEffect } from 'react';

interface ProfessionalSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  color?: string;
  showValue?: boolean;
  label?: string;
  className?: string;
}

const ProfessionalSlider: React.FC<ProfessionalSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  orientation = 'horizontal',
  size = 'medium',
  color = '#3b82f6',
  showValue = true,
  label,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  // Calcular el porcentaje del valor
  const percentage = ((value - min) / (max - min)) * 100;

  // Tamaños
  const sizes = {
    small: {
      track: orientation === 'horizontal' ? 'h-1' : 'w-1',
      knob: 'w-3 h-3',
      height: orientation === 'horizontal' ? 'h-6' : 'w-6'
    },
    medium: {
      track: orientation === 'horizontal' ? 'h-2' : 'w-2',
      knob: 'w-4 h-4',
      height: orientation === 'horizontal' ? 'h-8' : 'w-8'
    },
    large: {
      track: orientation === 'horizontal' ? 'h-3' : 'w-3',
      knob: 'w-5 h-5',
      height: orientation === 'horizontal' ? 'h-10' : 'w-10'
    }
  };

  const currentSize = sizes[size];

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMouseMove(e);
  };

  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    if (!sliderRef.current || !isDragging) return;

    const rect = sliderRef.current.getBoundingClientRect();
    let newValue;

    if (orientation === 'horizontal') {
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      newValue = min + (percentage / 100) * (max - min);
    } else {
      const y = e.clientY - rect.top;
      const percentage = Math.max(0, Math.min(100, (y / rect.height) * 100));
      newValue = min + (percentage / 100) * (max - min);
    }

    // Aplicar step
    newValue = Math.round(newValue / step) * step;
    newValue = Math.max(min, Math.min(max, newValue));

    onChange(newValue);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -step : step;
    const newValue = Math.max(min, Math.min(max, value + delta));
    onChange(newValue);
  };

  return (
    <div className={`flex flex-col items-center space-y-1 ${className}`}>
      {label && (
        <span className="text-xs text-gray-300 font-medium">{label}</span>
      )}
      
      <div
        ref={sliderRef}
        className={`
          relative ${currentSize.height} ${orientation === 'horizontal' ? 'w-20' : 'h-32'} 
          cursor-pointer select-none
          ${orientation === 'horizontal' ? 'flex items-center' : 'flex flex-col justify-end'}
        `}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {/* Track de fondo */}
        <div
          className={`
            absolute ${currentSize.track} rounded-full bg-gray-600
            ${orientation === 'horizontal' ? 'w-full' : 'h-full'}
          `}
        />
        
        {/* Track activo */}
        <div
          className={`
            absolute ${currentSize.track} rounded-full transition-all duration-150
            ${orientation === 'horizontal' ? 'w-full' : 'h-full'}
          `}
          style={{
            backgroundColor: color,
            ...(orientation === 'horizontal' 
              ? { width: `${percentage}%` }
              : { height: `${percentage}%`, bottom: 0 })
          }}
        />
        
        {/* Knob */}
        <div
          ref={knobRef}
          className={`
            absolute ${currentSize.knob} rounded-full bg-white shadow-lg
            border-2 border-gray-300 cursor-pointer transition-all duration-150
            hover:scale-110 active:scale-95
            ${isDragging ? 'scale-110 shadow-xl' : ''}
          `}
          style={{
            ...(orientation === 'horizontal' 
              ? { 
                  left: `calc(${percentage}% - ${size === 'small' ? '6px' : size === 'medium' ? '8px' : '10px'})`,
                  top: '50%',
                  transform: 'translateY(-50%)'
                }
              : { 
                  bottom: `calc(${percentage}% - ${size === 'small' ? '6px' : size === 'medium' ? '8px' : '10px'})`,
                  left: '50%',
                  transform: 'translateX(-50%)'
                })
          }}
        />
      </div>
      
      {showValue && (
        <span className="text-xs text-gray-400 font-mono">
          {Math.round(value * 100)}
        </span>
      )}
    </div>
  );
};

export default ProfessionalSlider;






