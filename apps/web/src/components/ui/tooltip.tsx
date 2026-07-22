/**
 * Tooltip Component with Glossary Support
 */
import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <span
          className={`absolute ${positions[side]} z-50 px-3 py-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg whitespace-normal max-w-xs animate-in fade-in duration-150`}
        >
          {content}
          <span
            className={`absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45 ${
              side === 'top'
                ? 'bottom-[-4px] left-1/2 -translate-x-1/2'
                : side === 'bottom'
                ? 'top-[-4px] left-1/2 -translate-x-1/2'
                : side === 'left'
                ? 'right-[-4px] top-1/2 -translate-y-1/2'
                : 'left-[-4px] top-1/2 -translate-y-1/2'
            }`}
          />
        </span>
      )}
    </span>
  );
}

interface GlossaryTermProps {
  term: string;
  definition: string;
  children: React.ReactNode;
}

export function GlossaryTerm({ term, definition, children }: GlossaryTermProps) {
  return (
    <Tooltip content={definition}>
      <span className="underline decoration-dotted decoration-muted-foreground underline-offset-2 cursor-help text-foreground">
        {children}
      </span>
    </Tooltip>
  );
}

// Predefined glossary terms for Sui transactions
export const GLOSSARY = {
  GAS_BUDGET: 'The maximum amount of SUI you\'re willing to pay for transaction execution',
  GAS_USED: 'The actual amount of SUI consumed by the transaction (computation + storage - rebate)',
  COMPUTATION_COST: 'Gas spent on executing the transaction logic and Move code',
  STORAGE_COST: 'Gas spent on storing new data on the blockchain',
  STORAGE_REBATE: 'Gas refunded from cleaning up or modifying existing storage',
  OBJECT_ID: 'Unique identifier for an object on the Sui blockchain',
  OBJECT_VERSION: 'Sequential number tracking how many times an object has been modified',
  DIGEST: 'Cryptographic hash uniquely identifying a transaction',
  PROGRAMMABLE_TRANSACTION: 'Transaction composed of multiple commands executed atomically',
  EVENT: 'Log emitted by a smart contract during execution to track important state changes',
  EFFECTS: 'The result of a transaction execution, including all object changes',
  MIST: 'Smallest unit of SUI (1 SUI = 1,000,000,000 MIST)',
  SHARED_OBJECT: 'Object that can be accessed by anyone, requires consensus to modify',
  OWNED_OBJECT: 'Object owned by a specific address, can be modified by owner only',
  EPOCH: 'Period of time on Sui (approximately 24 hours) used for validator rotation',
  PTB: 'Programmable Transaction Block - allows composing multiple operations in one transaction',
};

interface GlossaryIconProps {
  term: keyof typeof GLOSSARY;
  className?: string;
}

export function GlossaryIcon({ term, className = '' }: GlossaryIconProps) {
  return (
    <Tooltip content={GLOSSARY[term]}>
      <HelpCircle className={`inline-block w-3.5 h-3.5 text-muted-foreground cursor-help ${className}`} />
    </Tooltip>
  );
}
