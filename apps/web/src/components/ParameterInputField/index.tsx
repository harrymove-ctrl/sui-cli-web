import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  RefreshCw,
  Zap,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { TypeBadge } from './TypeBadge';
import { ObjectSuggestionDropdown } from './ObjectSuggestionDropdown';
import { VectorU8Converter } from './VectorU8Converter';
import { NumberInput } from './NumberInput';
import type { ParameterInputFieldProps } from './types';

export const ParameterInputField: React.FC<ParameterInputFieldProps> = ({
  parameter,
  value,
  onChange,
  onRefreshSuggestions,
  isLoading,
  error,
  disabled,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showVectorConverter, setShowVectorConverter] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { parsedType, suggestions, autoFilled, examples, validation, helpText } = parameter;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setShowHelp(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-fill effect
  useEffect(() => {
    if (autoFilled && !value) {
      onChange(autoFilled.value);
    }
  }, [autoFilled, value, onChange]);

  const hasObjectSuggestions =
    suggestions.length > 0 &&
    (parsedType.category === 'reference_mut' ||
      parsedType.category === 'reference' ||
      parsedType.category === 'owned');

  const isBooleanType = parsedType.category === 'primitive_bool';
  const isNumberType = parsedType.category.startsWith('primitive_u');
  const isVectorU8 = parsedType.category === 'vector_u8';
  const isAddressType = parsedType.category === 'primitive_address';

  const handleSuggestionSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setShowDropdown(false);
  };

  const handleVectorConvert = (result: string) => {
    onChange(result);
    setShowVectorConverter(false);
  };

  const renderInput = () => {
    // Boolean - inline toggle
    if (isBooleanType) {
      return (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`bool-${parameter.name}`}
              checked={value === 'true'}
              onChange={() => onChange('true')}
              disabled={disabled}
              className="accent-green-500 w-3 h-3"
            />
            <span className="text-xs text-gray-300">true</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`bool-${parameter.name}`}
              checked={value === 'false'}
              onChange={() => onChange('false')}
              disabled={disabled}
              className="accent-green-500 w-3 h-3"
            />
            <span className="text-xs text-gray-300">false</span>
          </label>
        </div>
      );
    }

    // Number types - compact input
    if (isNumberType) {
      return (
        <NumberInput
          value={value}
          onChange={onChange}
          min={validation?.min}
          max={validation?.max}
          placeholder={`${parsedType.baseType}`}
          disabled={disabled}
        />
      );
    }

    // Vector<u8> - compact converter
    if (isVectorU8) {
      if (showVectorConverter) {
        return (
          <VectorU8Converter
            value={value}
            onChange={onChange}
            onConvert={handleVectorConvert}
          />
        );
      }
      return (
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder='[bytes] or type text'
            disabled={disabled}
            className="w-full px-2 py-1.5 pr-16 text-xs bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:border-green-500 font-mono"
          />
          <button
            onClick={() => setShowVectorConverter(true)}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
            type="button"
          >
            Convert
          </button>
        </div>
      );
    }

    // Object/Reference types - with dropdown
    if (hasObjectSuggestions) {
      return (
        <div className="relative flex gap-1">
          <div className="relative flex-1">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Object ID"
              disabled={disabled}
              className="w-full px-2 py-1.5 pr-7 text-xs bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:border-green-500 font-mono"
            />
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              disabled={suggestions.length === 0}
              className={`absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 rounded transition-colors ${
                suggestions.length > 0
                  ? 'hover:bg-green-500/20 text-green-400'
                  : 'text-green-500/30 cursor-not-allowed'
              }`}
              type="button"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {onRefreshSuggestions && (
            <button
              onClick={onRefreshSuggestions}
              disabled={isLoading}
              className="p-1.5 bg-black/50 border border-green-500/30 rounded hover:bg-green-500/20 transition-colors"
              title="Refresh"
              type="button"
            >
              <RefreshCw className={`w-3 h-3 text-green-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}

          <ObjectSuggestionDropdown
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
            isOpen={showDropdown}
            onClose={() => setShowDropdown(false)}
          />
        </div>
      );
    }

    // Default - compact text input
    return (
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={examples[0]?.slice(0, 20) || parameter.type}
          disabled={disabled}
          className="w-full px-2 py-1.5 text-xs bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:border-green-500 font-mono"
        />

        {/* Address suggestions */}
        {isAddressType && suggestions.length > 0 && (
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 rounded hover:bg-green-500/20 text-green-400 transition-colors"
            type="button"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
        )}

        {isAddressType && (
          <ObjectSuggestionDropdown
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
            isOpen={showDropdown}
            onClose={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="space-y-1">
      {/* Compact Header - single line */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-green-400 font-mono truncate">{parameter.name}</span>
          <TypeBadge category={parsedType.category} type={parameter.type} />

          {/* Auto-filled indicator - compact */}
          {autoFilled && value === autoFilled.value && (
            <Zap className="w-3 h-3 text-yellow-400 flex-shrink-0" title="Auto-filled" />
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Warning for no objects */}
          {hasObjectSuggestions && suggestions.length === 0 && !isLoading && (
            <AlertCircle className="w-3 h-3 text-yellow-500" title="No matching objects" />
          )}

          {/* Help button - compact */}
          {helpText && (
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-0.5 rounded hover:bg-green-500/20 transition-colors"
              type="button"
              title={helpText}
            >
              <HelpCircle className="w-3 h-3 text-green-400/80" />
            </button>
          )}
        </div>
      </div>

      {/* Help text - collapsible */}
      {showHelp && helpText && (
        <div className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-400/70">
          {helpText}
        </div>
      )}

      {/* Input */}
      {renderInput()}

      {/* Vector converter back button */}
      {isVectorU8 && showVectorConverter && (
        <button
          onClick={() => setShowVectorConverter(false)}
          className="text-xs text-green-400/80 hover:text-green-400"
        >
          ← Direct input
        </button>
      )}

      {/* Error - inline */}
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="w-2.5 h-2.5" />
          {error}
        </div>
      )}
    </div>
  );
};

// Re-export sub-components
export { TypeBadge } from './TypeBadge';
export { ObjectSuggestionDropdown } from './ObjectSuggestionDropdown';
export { ObjectMetadataPopover } from './ObjectMetadataPopover';
export { VectorU8Converter } from './VectorU8Converter';
export { NumberInput } from './NumberInput';
export type * from './types';

export default ParameterInputField;
