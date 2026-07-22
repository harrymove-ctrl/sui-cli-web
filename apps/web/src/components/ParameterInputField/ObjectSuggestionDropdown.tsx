import React, { useState, useMemo } from 'react';
import { Search, Package, Wallet, Coins, ChevronRight } from 'lucide-react';
import { ObjectMetadataPopover } from './ObjectMetadataPopover';
import type { ObjectSuggestionDropdownProps } from './types';

const suggestionTypeIcons: Record<string, React.ReactNode> = {
  object: <Package className="w-3.5 h-3.5 text-purple-400" />,
  address: <Wallet className="w-3.5 h-3.5 text-yellow-400" />,
  coin: <Coins className="w-3.5 h-3.5 text-green-400" />,
  value: <ChevronRight className="w-3.5 h-3.5 text-gray-400" />,
};

export const ObjectSuggestionDropdown: React.FC<ObjectSuggestionDropdownProps> = ({
  suggestions,
  onSelect,
  isOpen,
  onClose,
  searchTerm = '',
  onSearchChange,
}) => {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  const filteredSuggestions = useMemo(() => {
    if (!localSearch) return suggestions;

    const search = localSearch.toLowerCase();
    return suggestions.filter(
      (s) =>
        s.label.toLowerCase().includes(search) ||
        s.value.toLowerCase().includes(search) ||
        s.metadata?.type?.toLowerCase().includes(search)
    );
  }, [suggestions, localSearch]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  const truncateValue = (value: string) => {
    if (!value || value.length < 20) return value;
    return `${value.slice(0, 10)}...${value.slice(-8)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-hidden">
      {/* Search */}
      {suggestions.length > 3 && (
        <div className="p-2 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search suggestions..."
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-cyan-500 text-gray-200"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Suggestions list */}
      <div className="overflow-y-auto max-h-48">
        {filteredSuggestions.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500">
            No matching suggestions found
          </div>
        ) : (
          filteredSuggestions.map((suggestion, idx) => (
            <ObjectMetadataPopover key={idx} suggestion={suggestion}>
              <button
                onClick={() => {
                  onSelect(suggestion.value);
                  onClose();
                }}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800 transition-colors text-left border-b border-gray-800 last:border-b-0"
              >
                {/* Icon */}
                <span className="flex-shrink-0">
                  {suggestionTypeIcons[suggestion.type] || suggestionTypeIcons.value}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 truncate">
                    {suggestion.label}
                  </div>
                  <div className="text-xs font-mono text-gray-500 truncate">
                    {truncateValue(suggestion.value)}
                  </div>
                </div>

                {/* Type badge for objects */}
                {suggestion.metadata?.type && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-mono bg-gray-800 text-gray-400 rounded">
                    {suggestion.metadata.type.split('::').pop()?.replace(/<.*>/, '') || 'Object'}
                  </span>
                )}
              </button>
            </ObjectMetadataPopover>
          ))
        )}
      </div>

      {/* Footer */}
      {suggestions.length > 0 && (
        <div className="p-2 border-t border-gray-700 text-xs text-gray-500 flex justify-between items-center">
          <span>{filteredSuggestions.length} of {suggestions.length} suggestions</span>
          <span className="text-gray-600">Hover for details</span>
        </div>
      )}
    </div>
  );
};

export default ObjectSuggestionDropdown;
