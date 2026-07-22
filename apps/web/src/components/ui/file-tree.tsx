"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface FileNode {
  name: string
  type: "file" | "folder"
  children?: FileNode[]
  extension?: string
  icon?: string
  badge?: string
  disabled?: boolean
  onClick?: () => void
}

interface FileTreeProps {
  data: FileNode[]
  className?: string
  title?: string
  onFileClick?: (node: FileNode) => void
}

interface FileItemProps {
  node: FileNode
  depth: number
  isLast: boolean
  parentPath: boolean[]
  onFileClick?: (node: FileNode) => void
}

const getFileIcon = (extension?: string, customIcon?: string) => {
  if (customIcon) {
    return { color: "text-[#4da2ff]", icon: customIcon }
  }

  const iconMap: Record<string, { color: string; icon: string }> = {
    // Move/Sui specific
    move: { color: "text-[#4da2ff]", icon: "◆" },
    toml: { color: "text-[#ff9f0a]", icon: "⚙" },
    // Web
    tsx: { color: "text-[#4da2ff]", icon: "⚛" },
    ts: { color: "text-[#4da2ff]", icon: "◆" },
    jsx: { color: "text-[#61dafb]", icon: "⚛" },
    js: { color: "text-[#f7df1e]", icon: "◆" },
    css: { color: "text-[#264de4]", icon: "◈" },
    json: { color: "text-[#ff9f0a]", icon: "{}" },
    md: { color: "text-white/50", icon: "◊" },
    svg: { color: "text-[#ffb13b]", icon: "◐" },
    png: { color: "text-[#34c759]", icon: "◑" },
    jpg: { color: "text-[#34c759]", icon: "◑" },
    // Default
    default: { color: "text-white/40", icon: "◇" },
  }
  return iconMap[extension || "default"] || iconMap.default
}

function FileItem({ node, depth, isLast, parentPath, onFileClick }: FileItemProps) {
  const [isOpen, setIsOpen] = useState(false) // Folders collapsed by default
  const [isHovered, setIsHovered] = useState(false)

  const isFolder = node.type === "folder"
  const hasChildren = isFolder && node.children && node.children.length > 0
  const fileIcon = getFileIcon(node.extension, node.icon)
  const isDisabled = node.disabled === true

  const handleClick = () => {
    if (isDisabled) return // Don't do anything if disabled
    if (isFolder) {
      setIsOpen(!isOpen)
    } else if (node.onClick) {
      node.onClick()
    } else if (onFileClick) {
      onFileClick(node)
    }
  }

  return (
    <div className="select-none">
      <div
        role={isFolder ? "treeitem" : "treeitem"}
        aria-expanded={isFolder ? isOpen : undefined}
        aria-selected={isHovered}
        aria-disabled={isDisabled}
        tabIndex={isDisabled ? -1 : 0}
        className={cn(
          "group relative flex items-center gap-2 py-1.5 px-3",
          "transition-all duration-150",
          isDisabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4da2ff]/50 focus:bg-white/5",
          isHovered && !isDisabled && "bg-white/5",
        )}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (isDisabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {/* Tree lines */}
        {depth > 0 && (
          <div
            className="absolute top-0 bottom-0 flex"
            style={{ left: `${(depth - 1) * 16 + 18}px` }}
          >
            <div className={cn(
              "w-px transition-colors duration-150",
              isHovered ? "bg-[#4da2ff]/40" : "bg-white/10"
            )} />
          </div>
        )}

        {/* Folder/File indicator */}
        <div
          className={cn(
            "flex items-center justify-center w-4 h-4 transition-transform duration-150 text-xs",
            isFolder && isOpen && "rotate-90",
          )}
        >
          {isFolder ? (
            <span className={cn(
              "transition-colors duration-150",
              isHovered ? "text-[#4da2ff]" : "text-white/40"
            )}>
              ▶
            </span>
          ) : (
            <span className={cn("transition-opacity duration-150 text-base", fileIcon.color)}>
              {fileIcon.icon}
            </span>
          )}
        </div>

        {/* Folder icon */}
        {isFolder && (
          <span className={cn(
            "text-base transition-all duration-150",
            isHovered ? "text-[#4da2ff]" : "text-[#4da2ff]/70"
          )}>
            {isOpen ? "📂" : "📁"}
          </span>
        )}

        {/* Name */}
        <span
          className={cn(
            "font-mono text-sm transition-colors duration-150 truncate",
            isFolder
              ? isHovered ? "text-white" : "text-white/80"
              : isHovered ? "text-white" : "text-white/70",
          )}
        >
          {node.name}
        </span>

        {/* Badge */}
        {node.badge && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-[#4da2ff]/20 text-[#4da2ff] rounded">
            {node.badge}
          </span>
        )}

        {/* Hover indicator */}
        {isHovered && !isFolder && (
          <span className="ml-auto text-[10px] text-white/40">
            [open]
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && (
        <div
          className={cn(
            "overflow-hidden transition-all duration-200",
            isOpen ? "opacity-100" : "opacity-0 h-0",
          )}
        >
          {node.children!.map((child, index) => (
            <FileItem
              key={child.name}
              node={child}
              depth={depth + 1}
              isLast={index === node.children!.length - 1}
              parentPath={[...parentPath, !isLast]}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ data, className, title = "explorer", onFileClick }: FileTreeProps) {
  return (
    <div
      role="tree"
      aria-label={`${title} file tree`}
      className={cn(
        "bg-[#1e1e2e]/90 rounded-lg border border-white/15 font-mono overflow-hidden",
        className,
      )}
    >
      {/* Terminal-style header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-black/20">
        <div className="flex gap-1.5" aria-hidden="true">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-white/50 uppercase tracking-wider ml-2">{title}</span>
      </div>

      {/* Tree */}
      <div role="group" className="py-2 max-h-[500px] overflow-y-auto scrollbar-thin">
        {data.length === 0 ? (
          <div className="px-4 py-4 text-center text-sm text-white/40">
            # no files
          </div>
        ) : (
          data.map((node, index) => (
            <FileItem
              key={node.name}
              node={node}
              depth={0}
              isLast={index === data.length - 1}
              parentPath={[]}
              onFileClick={onFileClick}
            />
          ))
        )}
      </div>
    </div>
  )
}

export type { FileNode, FileTreeProps }
