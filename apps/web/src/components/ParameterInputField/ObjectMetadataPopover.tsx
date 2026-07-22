import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import type { ObjectMetadataPopoverProps } from './types';

export const ObjectMetadataPopover: React.FC<ObjectMetadataPopoverProps> = ({
  suggestion,
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (suggestion.value) {
      await navigator.clipboard.writeText(suggestion.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 20) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  const metadata = suggestion.metadata;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}

      {isHovered && metadata && (
        <div className="absolute z-50 left-0 top-full mt-1 w-72 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-400">Object Details</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-gray-800 transition-colors"
                title="Copy Object ID"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-500" />
                )}
              </button>
              {metadata.objectId && (
                <a
                  href={`https://suiscan.xyz/testnet/object/${metadata.objectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded hover:bg-gray-800 transition-colors"
                  title="View on Explorer"
                >
                  <ExternalLink className="w-3 h-3 text-gray-500" />
                </a>
              )}
            </div>
          </div>

          {/* Object ID */}
          {metadata.objectId && (
            <div className="mb-2">
              <span className="text-xs text-gray-500">Object ID</span>
              <p className="text-xs font-mono text-cyan-400 break-all">
                {truncateAddress(metadata.objectId)}
              </p>
            </div>
          )}

          {/* Type */}
          {metadata.type && (
            <div className="mb-2">
              <span className="text-xs text-gray-500">Type</span>
              <p className="text-xs font-mono text-purple-400 break-all">
                {metadata.type.length > 50
                  ? `${metadata.type.slice(0, 50)}...`
                  : metadata.type}
              </p>
            </div>
          )}

          {/* Version & Digest */}
          <div className="flex gap-4 mb-2">
            {metadata.version && (
              <div>
                <span className="text-xs text-gray-500">Version</span>
                <p className="text-xs font-mono text-gray-300">{metadata.version}</p>
              </div>
            )}
            {metadata.digest && (
              <div>
                <span className="text-xs text-gray-500">Digest</span>
                <p className="text-xs font-mono text-gray-300">
                  {truncateAddress(metadata.digest)}
                </p>
              </div>
            )}
          </div>

          {/* Balance (for coins) */}
          {metadata.balance && (
            <div className="mb-2">
              <span className="text-xs text-gray-500">Balance</span>
              <p className="text-xs font-mono text-green-400">{metadata.balance}</p>
            </div>
          )}

          {/* Fields preview */}
          {metadata.fields && Object.keys(metadata.fields).length > 0 && (
            <div>
              <span className="text-xs text-gray-500">Fields</span>
              <div className="mt-1 p-2 bg-gray-800 rounded text-xs font-mono max-h-24 overflow-auto">
                {Object.entries(metadata.fields).slice(0, 5).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-gray-500">{key}:</span>
                    <span className="text-gray-300 truncate">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
                {Object.keys(metadata.fields).length > 5 && (
                  <span className="text-gray-500">...and more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ObjectMetadataPopover;
