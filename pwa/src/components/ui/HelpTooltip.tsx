'use client';

import { useState, useRef, useEffect } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface HelpTooltipProps {
  /** The tooltip text or translation key */
  text: string;
  /** Optional position preference */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional custom icon size */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Optional custom class for the icon */
  iconClassName?: string;
}

/**
 * HelpTooltip - An i18n-ready tooltip component
 *
 * For future i18n support:
 * 1. Replace the `text` prop with a translation key
 * 2. Use a translation function like t(text) or useTranslation().t(text)
 * 3. The component structure remains the same
 *
 * Example future usage with i18n:
 * <HelpTooltip text="settings.platformName.help" />
 */
export default function HelpTooltip({
  text,
  position = 'top',
  iconSize = 'sm',
  iconClassName = '',
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Icon sizes
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Adjust position if tooltip would overflow viewport
  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const container = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newPosition = position;

      // Check horizontal overflow
      if (position === 'right' && tooltip.right > viewportWidth) {
        newPosition = 'left';
      } else if (position === 'left' && tooltip.left < 0) {
        newPosition = 'right';
      }

      // Check vertical overflow
      if (position === 'top' && tooltip.top < 0) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && tooltip.bottom > viewportHeight) {
        newPosition = 'top';
      }

      // Also check if top/bottom tooltips overflow horizontally
      if ((position === 'top' || position === 'bottom') && tooltip.right > viewportWidth) {
        // Keep position but we'll handle alignment in CSS
      }

      setActualPosition(newPosition);
    }
  }, [isVisible, position]);

  // Position classes
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  // Arrow classes
  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800',
  };

  // Future i18n hook point:
  // const { t } = useTranslation();
  // const translatedText = t(text);
  const translatedText = text; // Direct text for now

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <button
        type="button"
        className={`
          text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2
          focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900
          rounded-full transition-colors cursor-help
          ${iconSizes[iconSize]}
          ${iconClassName}
        `}
        aria-label="Súgó"
        tabIndex={0}
      >
        <QuestionMarkCircleIcon className="w-full h-full" />
      </button>

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`
            absolute z-50 px-3 py-2 text-sm text-white bg-gray-800
            rounded-lg shadow-lg max-w-xs whitespace-normal
            animate-in fade-in duration-150
            ${positionClasses[actualPosition]}
          `}
        >
          {translatedText}
          {/* Arrow */}
          <div
            className={`
              absolute w-0 h-0 border-[6px]
              ${arrowClasses[actualPosition]}
            `}
          />
        </div>
      )}
    </div>
  );
}

/**
 * FormLabel with integrated HelpTooltip
 * Convenience component for form fields
 */
interface FormLabelWithHelpProps {
  /** The label text */
  label: string;
  /** The help tooltip text */
  helpText: string;
  /** HTML for attribute */
  htmlFor?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Additional class for the label */
  className?: string;
}

export function FormLabelWithHelp({
  label,
  helpText,
  htmlFor,
  required = false,
  className = '',
}: FormLabelWithHelpProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-300"
      >
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <HelpTooltip text={helpText} />
    </div>
  );
}
