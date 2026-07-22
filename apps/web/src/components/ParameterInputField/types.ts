import type { AnalyzedParameter, ParameterSuggestion } from '@/api/client';

export interface ParameterInputFieldProps {
  parameter: AnalyzedParameter;
  value: string;
  onChange: (value: string) => void;
  onRefreshSuggestions?: () => void;
  isLoading?: boolean;
  error?: string;
  disabled?: boolean;
}

export interface ObjectSuggestionDropdownProps {
  suggestions: ParameterSuggestion[];
  onSelect: (value: string) => void;
  isOpen: boolean;
  onClose: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export interface ObjectMetadataPopoverProps {
  suggestion: ParameterSuggestion;
  children: React.ReactNode;
}

export interface VectorU8ConverterProps {
  value: string;
  onChange: (value: string) => void;
  onConvert: (result: string) => void;
}

export interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
}

export interface TypeBadgeProps {
  category: string;
  type: string;
}

export type { AnalyzedParameter, ParameterSuggestion };
