import React, { useState, useEffect } from 'react';
import { AlertCircle, Calculator } from 'lucide-react';
import type { NumberInputProps } from './types';

// Quick presets for common values
const QUICK_PRESETS = [
  { label: '1 SUI', value: '1000000000' },
  { label: '0.1 SUI', value: '100000000' },
  { label: '0.01 SUI', value: '10000000' },
];

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    validateValue(value);
  }, [value, min, max]);

  const validateValue = (val: string) => {
    if (!val) {
      setError(null);
      return true;
    }

    if (!/^\d+$/.test(val)) {
      setError('Invalid');
      return false;
    }

    try {
      const numVal = BigInt(val);
      if (min !== undefined && numVal < BigInt(min)) {
        setError('Too small');
        return false;
      }
      if (max !== undefined && numVal > BigInt(max)) {
        setError('Too large');
        return false;
      }
      setError(null);
      return true;
    } catch {
      setError('Invalid');
      return false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/[^0-9]/g, '');
    onChange(newValue);
  };

  const formatWithCommas = (val: string): string => {
    if (!val) return '';
    return val.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  return (
    <div className="space-y-0.5">
      <div className="relative flex gap-1">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder || '0'}
          disabled={disabled}
          className={`flex-1 px-2 py-1.5 text-xs bg-black/50 border rounded text-green-400 placeholder:text-green-500/40 focus:outline-none font-mono ${
            error
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-green-500/30 focus:border-green-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />

        {/* Preset button */}
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="p-1.5 bg-black/50 border border-green-500/30 rounded hover:bg-green-500/20 transition-colors"
          title="Presets"
          type="button"
        >
          <Calculator className="w-3 h-3 text-green-400" />
        </button>

        {/* Presets dropdown */}
        {showPresets && (
          <div className="absolute z-30 right-0 top-full mt-1 w-32 bg-gray-900 border border-green-500/30 rounded shadow-xl">
            {QUICK_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onChange(preset.value);
                  setShowPresets(false);
                }}
                className="w-full px-2 py-1.5 text-left hover:bg-green-500/20 transition-colors text-xs"
              >
                <span className="text-green-400">{preset.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inline info */}
      <div className="flex items-center justify-between text-xs">
        {value && !error && (
          <span className="text-green-400/80 font-mono">= {formatWithCommas(value)}</span>
        )}
        {error && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertCircle className="w-2.5 h-2.5" />
            {error}
          </span>
        )}
        {!value && !error && min && max && (
          <span className="text-green-500/30">0 - {max.length > 10 ? 'max u64' : max}</span>
        )}
      </div>
    </div>
  );
};

export default NumberInput;
