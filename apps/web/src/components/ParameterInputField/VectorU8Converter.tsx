import React, { useState, useCallback, useEffect } from 'react';
import { ArrowRight, Copy, Check, FileText, Binary } from 'lucide-react';
import type { VectorU8ConverterProps } from './types';

type ConversionMode = 'string' | 'hex';

export const VectorU8Converter: React.FC<VectorU8ConverterProps> = ({
  value,
  onChange,
  onConvert,
}) => {
  const [mode, setMode] = useState<ConversionMode>('string');
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<string>('');

  const convertToBytes = useCallback((input: string, inputMode: ConversionMode): string => {
    if (!input) return '';

    try {
      if (inputMode === 'hex') {
        const cleanHex = input.startsWith('0x') ? input.slice(2) : input;
        if (!/^[a-fA-F0-9]*$/.test(cleanHex)) {
          return 'Invalid hex';
        }
        const bytes: number[] = [];
        for (let i = 0; i < cleanHex.length; i += 2) {
          bytes.push(parseInt(cleanHex.substr(i, 2), 16));
        }
        return `[${bytes.join(',')}]`;
      } else {
        const encoder = new TextEncoder();
        const bytes = Array.from(encoder.encode(input));
        return `[${bytes.join(',')}]`;
      }
    } catch {
      return 'Error';
    }
  }, []);

  // Update preview when value or mode changes
  useEffect(() => {
    if (value) {
      setPreview(convertToBytes(value, mode));
    } else {
      setPreview('');
    }
  }, [value, mode, convertToBytes]);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleConvert = () => {
    const result = convertToBytes(value, mode);
    if (!result.startsWith('Invalid') && !result.startsWith('Error')) {
      onConvert(result);
    }
  };

  const handleCopyPreview = async () => {
    if (preview && !preview.startsWith('Invalid') && !preview.startsWith('Error')) {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isValidPreview = preview && !preview.startsWith('Invalid') && !preview.startsWith('Error');

  return (
    <div className="space-y-1.5">
      {/* Mode + Input in one row */}
      <div className="flex gap-1">
        {/* Mode toggles - compact */}
        <div className="flex">
          <button
            onClick={() => setMode('string')}
            className={`px-1.5 py-1 text-xs rounded-l border-r-0 transition-colors ${
              mode === 'string'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-black/50 text-green-400/80 border border-green-500/30 hover:bg-green-500/10'
            }`}
            title="String input"
          >
            <FileText className="w-3 h-3" />
          </button>
          <button
            onClick={() => setMode('hex')}
            className={`px-1.5 py-1 text-xs rounded-r transition-colors ${
              mode === 'hex'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : 'bg-black/50 text-green-400/80 border border-green-500/30 hover:bg-green-500/10'
            }`}
            title="Hex input"
          >
            <Binary className="w-3 h-3" />
          </button>
        </div>

        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={mode === 'string' ? 'text' : '0x...'}
          className="flex-1 px-2 py-1 text-xs bg-black/50 border border-green-500/30 rounded text-green-400 placeholder:text-green-500/40 focus:outline-none focus:border-green-500 font-mono"
        />
      </div>

      {/* Preview + Actions */}
      {value && (
        <div className="flex items-center gap-1">
          <div className="flex-1 flex items-center gap-1 px-1.5 py-1 bg-black/30 border border-green-500/20 rounded min-w-0">
            <ArrowRight className="w-2.5 h-2.5 text-green-400/80 flex-shrink-0" />
            <code className={`text-xs font-mono truncate ${isValidPreview ? 'text-green-400' : 'text-red-400'}`}>
              {preview || '...'}
            </code>
          </div>

          <button
            onClick={handleCopyPreview}
            disabled={!isValidPreview}
            className={`p-1 rounded transition-colors ${
              isValidPreview
                ? 'bg-black/50 hover:bg-green-500/20 text-green-400'
                : 'bg-black/30 text-green-500/20 cursor-not-allowed'
            }`}
            title="Copy"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={handleConvert}
            disabled={!isValidPreview}
            className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
              isValidPreview
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-black/30 text-green-500/20 cursor-not-allowed'
            }`}
          >
            Use
          </button>
        </div>
      )}

      {/* Help */}
      <div className="text-xs text-green-500/40">
        {mode === 'string' ? 'UTF-8 encoded' : 'Hex → bytes'}
      </div>
    </div>
  );
};

export default VectorU8Converter;
