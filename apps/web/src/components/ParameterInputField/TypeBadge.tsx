import React from 'react';
import type { TypeBadgeProps } from './types';

const categoryColors: Record<string, string> = {
  reference_mut: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  reference: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  owned: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  primitive_u8: 'bg-green-500/20 text-green-400 border-green-500/30',
  primitive_u16: 'bg-green-500/20 text-green-400 border-green-500/30',
  primitive_u32: 'bg-green-500/20 text-green-400 border-green-500/30',
  primitive_u64: 'bg-green-500/20 text-green-400 border-green-500/30',
  primitive_u128: 'bg-green-500/20 text-green-400 border-green-500/30',
  primitive_u256: 'bg-green-500/20 text-green-400 border-green-500/30',
  primitive_bool: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  primitive_address: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  vector_u8: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  vector: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  option: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  type_param: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const categoryLabels: Record<string, string> = {
  reference_mut: '&mut',
  reference: '&ref',
  owned: 'object',
  primitive_u8: 'u8',
  primitive_u16: 'u16',
  primitive_u32: 'u32',
  primitive_u64: 'u64',
  primitive_u128: 'u128',
  primitive_u256: 'u256',
  primitive_bool: 'bool',
  primitive_address: 'address',
  vector_u8: 'vector<u8>',
  vector: 'vector',
  option: 'Option',
  type_param: 'generic',
  unknown: 'unknown',
};

export const TypeBadge: React.FC<TypeBadgeProps> = ({ category, type }) => {
  const colorClass = categoryColors[category] || categoryColors.unknown;
  const label = categoryLabels[category] || category;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-2 py-0.5 text-xs font-mono rounded border ${colorClass}`}
        title={type}
      >
        {label}
      </span>
    </div>
  );
};

export default TypeBadge;
