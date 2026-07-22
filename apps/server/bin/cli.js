#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createInterface } from 'readline';
import net from 'net';
import os from 'os';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Detect environment
const isWindows = process.platform === 'win32';
const isWSL = (() => {
  if (process.platform !== 'linux') return false;
  try {
    // Check for WSL indicators
    if (fs.existsSync('/proc/version')) {
      const version = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
      return version.includes('microsoft') || version.includes('wsl');
    }
    // Alternative: check for WSL environment variables
    return !!process.env.WSL_DISTRO_NAME || !!process.env.WSLENV;
  } catch {
    return false;
  }
})();
const isLinux = process.platform === 'linux' && !isWSL;

// Check if terminal supports colors
const supportsColor = (() => {
  // Force no color if NO_COLOR env is set (standard)
  if (process.env.NO_COLOR !== undefined) return false;
  // Force color if FORCE_COLOR is set
  if (process.env.FORCE_COLOR !== undefined) return true;
  // Check if stdout is a TTY
  if (!process.stdout.isTTY) return false;
  // Windows cmd.exe supports colors since Windows 10
  if (isWindows) {
    const osRelease = os.release().split('.');
    // Windows 10+ (version 10.x.x)
    return parseInt(osRelease[0], 10) >= 10;
  }
  // Most Unix terminals support color
  return true;
})();

// ANSI colors (with fallback for terminals without color support)
const c = supportsColor
  ? {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      cyan: '\x1b[36m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      white: '\x1b[37m',
      inverse: '\x1b[7m',
      hideCursor: '\x1b[?25l',
      showCursor: '\x1b[?25h',
      clearLine: '\x1b[2K',
      moveUp: (n = 1) => `\x1b[${n}A`,
      moveDown: (n = 1) => `\x1b[${n}B`,
      moveToColumn: (n = 1) => `\x1b[${n}G`,
    }
  : {
      reset: '',
      bold: '',
      dim: '',
      cyan: '',
      green: '',
      yellow: '',
      red: '',
      white: '',
      inverse: '',
      hideCursor: '',
      showCursor: '',
      clearLine: '',
      moveUp: () => '',
      moveDown: () => '',
      moveToColumn: () => '',
    };

// Common ports to suggest
const SUGGESTED_PORTS = [3001, 3002, 3003, 3004, 3005, 4001, 4002, 8001, 8080];

// Check if a port is in use (cross-platform using Node.js net module)
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    // Use 0.0.0.0 for better cross-platform compatibility
    server.listen(port, '0.0.0.0');
  });
}

// Get process using a port (for display purposes) - cross-platform
function getProcessOnPort(port) {
  try {
    if (isWindows) {
      // Windows: use netstat and tasklist
      const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      // Parse: TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    12345
      const lines = result.trim().split('\n');
      for (const line of lines) {
        const match = line.match(/LISTENING\s+(\d+)/);
        if (match) {
          const pid = match[1];
          try {
            const processInfo = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'pipe'],
              windowsHide: true,
            });
            const processMatch = processInfo.match(/"([^"]+)"/);
            return processMatch ? processMatch[1].replace('.exe', '') : `PID ${pid}`;
          } catch {
            return `PID ${pid}`;
          }
        }
      }
    } else if (isWSL) {
      // WSL: try Linux commands first, fall back to Windows if needed
      try {
        // Try ss command (more reliable in WSL)
        const result = execSync(`ss -tlnp 2>/dev/null | grep :${port} || true`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        if (result.trim()) {
          // Parse: users:(("node",pid=12345,fd=22))
          const match = result.match(/users:\(\("([^"]+)"/);
          if (match) return match[1];

          const pidMatch = result.match(/pid=(\d+)/);
          if (pidMatch) {
            const pid = pidMatch[1];
            try {
              const processName = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe'],
              });
              return processName.trim() || `PID ${pid}`;
            } catch {
              return `PID ${pid}`;
            }
          }
        }

        // Try lsof as fallback
        const lsofResult = execSync(`lsof -i :${port} -t 2>/dev/null | head -1`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        const pid = lsofResult.trim();
        if (pid) {
          const processName = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return processName.trim() || `PID ${pid}`;
        }
      } catch {
        // Ignore - WSL might not have these tools
      }
    } else {
      // macOS and Linux
      // Try lsof first (works on both macOS and most Linux)
      try {
        const result = execSync(`lsof -i :${port} -t 2>/dev/null | head -1`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        const pid = result.trim();
        if (pid) {
          const processName = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          return processName.trim() || `PID ${pid}`;
        }
      } catch {
        // lsof might not be available, try ss (Linux)
      }

      // Try ss command (Linux, usually available)
      if (isLinux) {
        try {
          const result = execSync(`ss -tlnp 2>/dev/null | grep :${port} || true`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          if (result.trim()) {
            const match = result.match(/users:\(\("([^"]+)"/);
            if (match) return match[1];

            const pidMatch = result.match(/pid=(\d+)/);
            if (pidMatch) return `PID ${pidMatch[1]}`;
          }
        } catch {
          // Ignore
        }
      }

      // Try netstat as last resort
      try {
        const result = execSync(`netstat -tlnp 2>/dev/null | grep :${port} || true`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        if (result.trim()) {
          const match = result.match(/(\d+)\/(\S+)/);
          if (match) return match[2];
        }
      } catch {
        // Ignore
      }
    }
  } catch {
    // Silently ignore all errors
  }
  return null;
}

// Check all suggested ports in parallel for better performance
async function checkPorts() {
  const checks = SUGGESTED_PORTS.map(async (port) => {
    const inUse = await isPortInUse(port);
    const processName = inUse ? getProcessOnPort(port) : null;
    return { port, inUse, processName };
  });

  return Promise.all(checks);
}

// Interactive menu with arrow key navigation - cross-platform
function interactiveSelect(portStatus) {
  return new Promise((resolve) => {
    let selectedIndex = 0;

    const bullet = supportsColor ? '●' : '*';
    const pointer = supportsColor ? '❯' : '>';

    // Build the full menu items including in-use ports for display
    const menuItems = [];
    let availableIndex = 0;

    for (const { port, inUse, processName } of portStatus) {
      if (inUse) {
        menuItems.push({
          type: 'disabled',
          port,
          processName,
        });
      } else {
        const isDefault = port === 3001;
        menuItems.push({
          type: 'port',
          port,
          index: availableIndex,
          isDefault,
        });
        availableIndex++;
      }
    }

    // Add custom and quit options
    menuItems.push({ type: 'custom' });
    menuItems.push({ type: 'quit' });

    // Get selectable items (not disabled)
    const selectableItems = menuItems.filter((item) => item.type !== 'disabled');

    // Calculate total lines for the menu
    const totalLines = menuItems.length + 2; // +1 for header, +1 for empty line at end

    // Render a single menu item
    function renderItem(item, selectableIdx) {
      const isSelected = selectableIdx === selectedIndex;
      const prefix = isSelected ? `${c.cyan}${pointer}${c.reset}` : ' ';

      if (item.type === 'disabled') {
        return `     ${c.dim}${item.port}${c.reset}  ${c.red}${bullet} in use${item.processName ? ` (${item.processName})` : ''}${c.reset}`;
      } else if (item.type === 'port') {
        const defaultLabel = item.isDefault ? ` ${c.cyan}(default)${c.reset}` : '';
        if (isSelected) {
          return `  ${prefix} ${c.cyan}${c.bold}${item.port}  ${bullet} available${defaultLabel}${c.reset}`;
        } else {
          return `  ${prefix} ${c.white}${item.port}${c.reset}  ${c.green}${bullet} available${c.reset}${defaultLabel}`;
        }
      } else if (item.type === 'custom') {
        if (isSelected) {
          return `  ${prefix} ${c.yellow}${c.bold}Custom port${c.reset}`;
        } else {
          return `  ${prefix} ${c.yellow}Custom port${c.reset}`;
        }
      } else if (item.type === 'quit') {
        if (isSelected) {
          return `  ${prefix} ${c.dim}${c.bold}Quit${c.reset}`;
        } else {
          return `  ${prefix} ${c.dim}Quit${c.reset}`;
        }
      }
      return '';
    }

    // Render entire menu
    function renderMenu(isInitial = false) {
      // Move cursor up to beginning of menu area (only if not initial render)
      if (!isInitial) {
        process.stdout.write(`\x1b[${totalLines}A`);
      }

      // Header line - clear and write
      process.stdout.write('\x1b[2K'); // Clear line
      process.stdout.write(`${c.white}${c.bold}  Select a port:${c.reset} ${c.dim}(↑↓ to navigate, Enter to select)${c.reset}\n`);

      // Render each menu item
      let selectableIdx = 0;
      for (const item of menuItems) {
        process.stdout.write('\x1b[2K'); // Clear line
        if (item.type === 'disabled') {
          process.stdout.write(renderItem(item, -1) + '\n');
        } else {
          process.stdout.write(renderItem(item, selectableIdx) + '\n');
          selectableIdx++;
        }
      }

      // Empty line at end
      process.stdout.write('\x1b[2K\n');
    }

    // Initial render
    renderMenu(true);

    // Hide cursor
    process.stdout.write(c.hideCursor);

    // Setup raw mode for key input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const cleanup = () => {
      process.stdout.write(c.showCursor);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      process.stdin.removeListener('data', onKeyPress);
    };

    const onKeyPress = (key) => {
      // Handle Ctrl+C
      if (key === '\u0003') {
        cleanup();
        console.log(`\n${c.dim}Cancelled.${c.reset}`);
        process.exit(0);
      }

      // Handle arrow keys and other inputs
      // Arrow keys send escape sequences
      if (key === '\u001b[A' || key === 'k') {
        // Up arrow or k
        selectedIndex = (selectedIndex - 1 + selectableItems.length) % selectableItems.length;
        renderMenu(false);
      } else if (key === '\u001b[B' || key === 'j') {
        // Down arrow or j
        selectedIndex = (selectedIndex + 1) % selectableItems.length;
        renderMenu(false);
      } else if (key === '\r' || key === '\n' || key === ' ') {
        // Enter or Space
        cleanup();
        const selected = selectableItems[selectedIndex];
        resolve(selected);
      } else if (key === 'q' || key === '\u001b') {
        // q or Escape
        cleanup();
        resolve({ type: 'quit' });
      } else if (key === 'c') {
        // c for custom
        cleanup();
        resolve({ type: 'custom' });
      } else if (key >= '1' && key <= '9') {
        // Number keys for quick selection
        const num = parseInt(key, 10);
        const portItems = selectableItems.filter((item) => item.type === 'port');
        if (num <= portItems.length) {
          cleanup();
          resolve(portItems[num - 1]);
        }
      }
    };

    process.stdin.on('data', onKeyPress);
  });
}

// Print header
function printHeader() {
  const boxChars = supportsColor
    ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
    : { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' };

  const rocket = supportsColor ? '🚀' : '>>';

  console.log(`
${c.cyan}${c.bold}${boxChars.tl}${'═'.repeat(63)}${boxChars.tr}${c.reset}
${c.cyan}${c.bold}${boxChars.v}                                                               ${boxChars.v}${c.reset}
${c.cyan}${c.bold}${boxChars.v}   ${rocket} Sui CLI Web Server - Port Selection                      ${boxChars.v}${c.reset}
${c.cyan}${c.bold}${boxChars.v}                                                               ${boxChars.v}${c.reset}
${c.cyan}${c.bold}${boxChars.bl}${'═'.repeat(63)}${boxChars.br}${c.reset}
`);
}

// Read user input - cross-platform (fallback for non-TTY)
function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Start the server with selected port
function startServer(port) {
  const serverPath = join(__dirname, '..', 'dist', 'index.js');

  // Use shell: true on Windows for better compatibility
  const spawnOptions = {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  };

  // On Windows, use shell to ensure proper signal handling
  if (isWindows) {
    spawnOptions.shell = true;
    spawnOptions.windowsHide = false;
  }

  const server = spawn('node', [serverPath], spawnOptions);

  server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  // Handle graceful shutdown
  const shutdown = (signal) => {
    if (isWindows) {
      // Windows doesn't support SIGINT/SIGTERM properly
      server.kill();
    } else {
      server.kill(signal);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Windows-specific: handle Ctrl+C
  if (isWindows) {
    process.on('SIGHUP', () => shutdown('SIGHUP'));
  }
}

// Check if running in a non-interactive environment
function isInteractive() {
  // Check if stdin is a TTY (terminal)
  if (!process.stdin.isTTY) return false;
  // Check common CI environment variables
  if (process.env.CI) return false;
  if (process.env.CONTINUOUS_INTEGRATION) return false;
  if (process.env.GITHUB_ACTIONS) return false;
  if (process.env.JENKINS_URL) return false;
  if (process.env.GITLAB_CI) return false;
  return true;
}

// Print help message
function printHelp() {
  console.log(`
${c.cyan}${c.bold}Sui CLI Web Server${c.reset}

${c.white}${c.bold}Usage:${c.reset}
  sui-cli-web [options]
  npx sui-cli-web-server [options]

${c.white}${c.bold}Options:${c.reset}
  -p, --port <port>   Specify port number
  -y, --no-prompt     Skip interactive port selection (use default 3001)
  -h, --help          Show this help message

${c.white}${c.bold}Examples:${c.reset}
  sui-cli-web                    # Interactive port selection
  sui-cli-web -p 3002            # Use port 3002
  sui-cli-web --port=8080        # Use port 8080
  PORT=3002 sui-cli-web          # Use port from env variable
  sui-cli-web -y                 # Use default port without prompt

${c.white}${c.bold}Navigation:${c.reset}
  ↑/↓ or j/k          Move selection up/down
  Enter or Space      Confirm selection
  1-9                 Quick select port by number
  c                   Enter custom port
  q or Esc            Quit

${c.white}${c.bold}Environment:${c.reset}
  PORT                Set server port
  NO_COLOR            Disable colored output
  FORCE_COLOR         Force colored output
`);
}

// Main function
async function main() {
  // Check if PORT is already set via environment or command line
  const args = process.argv.slice(2);

  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const portArg = args.find((arg) => arg.startsWith('--port=') || arg.startsWith('-p='));
  const portArgIndex = args.findIndex((arg) => arg === '--port' || arg === '-p');

  let presetPort = null;

  if (portArg) {
    presetPort = parseInt(portArg.split('=')[1], 10);
  } else if (portArgIndex !== -1 && args[portArgIndex + 1]) {
    presetPort = parseInt(args[portArgIndex + 1], 10);
  } else if (process.env.PORT) {
    presetPort = parseInt(process.env.PORT, 10);
  }

  // If --no-prompt flag is set or non-interactive environment, use default or preset port
  if (args.includes('--no-prompt') || args.includes('-y') || !isInteractive()) {
    const port = presetPort || 3001;

    // Still check if port is available
    const inUse = await isPortInUse(port);
    if (inUse) {
      console.error(`${c.red}Error: Port ${port} is already in use.${c.reset}`);
      console.error(`${c.dim}Use --port=<port> to specify a different port.${c.reset}`);
      process.exit(1);
    }

    console.log(`${c.cyan}Starting server on port ${port}...${c.reset}`);
    startServer(port);
    return;
  }

  // If port is preset via env or arg, just start
  if (presetPort) {
    if (isNaN(presetPort) || presetPort < 1 || presetPort > 65535) {
      console.error(`${c.red}Error: Invalid port number "${presetPort}".${c.reset}`);
      console.error(`${c.dim}Port must be between 1 and 65535.${c.reset}`);
      process.exit(1);
    }

    const inUse = await isPortInUse(presetPort);
    if (inUse) {
      const processName = getProcessOnPort(presetPort);
      const processInfo = processName ? ` (used by ${processName})` : '';
      console.error(`${c.red}Error: Port ${presetPort} is already in use${processInfo}.${c.reset}`);
      process.exit(1);
    }
    console.log(`${c.cyan}Starting server on port ${presetPort}...${c.reset}`);
    startServer(presetPort);
    return;
  }

  // Interactive mode: check ports and show menu
  console.log(`\n${c.dim}Checking available ports...${c.reset}`);
  const portStatus = await checkPorts();

  // Get available ports
  const availablePorts = portStatus.filter((p) => !p.inUse).map((p) => p.port);

  // If no ports available, ask for custom
  if (availablePorts.length === 0) {
    printHeader();
    console.log(`${c.yellow}All suggested ports are in use.${c.reset}`);
    const customPort = await prompt(`${c.white}Enter a custom port number: ${c.reset}`);
    const port = parseInt(customPort, 10);

    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(`${c.red}Invalid port number.${c.reset}`);
      process.exit(1);
    }

    const inUse = await isPortInUse(port);
    if (inUse) {
      console.error(`${c.red}Port ${port} is also in use.${c.reset}`);
      process.exit(1);
    }

    startServer(port);
    return;
  }

  // Print header
  printHeader();

  // Use interactive selection with arrow keys
  const selected = await interactiveSelect(portStatus);

  if (selected.type === 'quit') {
    console.log(`${c.dim}Goodbye!${c.reset}`);
    process.exit(0);
  }

  if (selected.type === 'custom') {
    const customPort = await prompt(`${c.white}Enter custom port number: ${c.reset}`);
    const port = parseInt(customPort, 10);

    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(`${c.red}Invalid port number.${c.reset}`);
      process.exit(1);
    }

    const inUse = await isPortInUse(port);
    if (inUse) {
      console.error(`${c.red}Port ${port} is in use.${c.reset}`);
      process.exit(1);
    }

    console.log(`\n${c.cyan}Starting server on port ${port}...${c.reset}\n`);
    startServer(port);
    return;
  }

  if (selected.type === 'port') {
    console.log(`\n${c.cyan}Starting server on port ${selected.port}...${c.reset}\n`);
    startServer(selected.port);
    return;
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
