import { Bot, ChevronDown, Code2, FileText, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CopyForAiMenuProps {
  /** A ready-made natural-language prompt describing the current view. */
  prompt: string;
  /** Raw structured data for the current view, if there's something worth exporting as-is. */
  json?: string;
  /** A markdown rendering of what's currently visible, if distinct from `json`. */
  markdown?: string;
  onCopy: (text: string, label: string) => void;
  className?: string;
}

function openWithQuery(base: string, query: string) {
  window.open(`${base}?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
}

export function CopyForAiMenu({ prompt, json, markdown, onCopy, className }: CopyForAiMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground',
            className
          )}
          aria-label="Copy for AI"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {/* Label collapses on phones so toolbars stay one row - the icon plus
              the caret still read as a menu. */}
          <span className="hidden lg:inline">Copy for AI</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onCopy(prompt, 'Prompt')}>
          <Sparkles className="w-4 h-4" />
          Copy prompt
        </DropdownMenuItem>
        {json ? (
          <DropdownMenuItem onClick={() => onCopy(json, 'JSON')}>
            <Code2 className="w-4 h-4" />
            Copy as JSON
          </DropdownMenuItem>
        ) : null}
        {markdown ? (
          <DropdownMenuItem onClick={() => onCopy(markdown, 'Markdown')}>
            <FileText className="w-4 h-4" />
            Copy page as markdown
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openWithQuery('https://chatgpt.com/', prompt)}>
          <Bot className="w-4 h-4" />
          Open in ChatGPT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openWithQuery('https://claude.ai/new', prompt)}>
          <Sparkles className="w-4 h-4" />
          Open in Claude
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
