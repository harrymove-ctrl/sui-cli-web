/**
 * Move Development Studio - Main Orchestrator
 * Redesigned with component composition and proper state management
 */

import { Rocket, Settings } from 'lucide-react';
import { PackageSelector } from './components/PackageManagement/PackageSelector';
import { BuildCard } from './components/Operations/BuildCard';
import { useMoveDevStore, selectCurrentPackage, selectUI } from './hooks/state/useMoveDevState';

export default function MoveDevelopmentStudio() {
  const currentPackage = useMoveDevStore(selectCurrentPackage);
  const ui = useMoveDevStore(selectUI);
  const setNetwork = useMoveDevStore((state) => state.setNetwork);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Rocket className="h-8 w-8 text-blue-400" />
              Move Development Studio
            </h1>
            <p className="text-gray-400 mt-1">
              Build, test, and deploy Move packages with ease
            </p>
          </div>

          {/* Network Selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Network:</span>
            <select
              value={ui.selectedNetwork}
              onChange={(e) => setNetwork(e.target.value as any)}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            >
              <option value="mainnet">Mainnet</option>
              <option value="testnet">Testnet</option>
              <option value="devnet">Devnet</option>
              <option value="localnet">Localnet</option>
            </select>
          </div>
        </div>

        {/* Package Selection */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Select Package</h2>
          <PackageSelector />
        </div>

        {/* Operations Section */}
        {currentPackage && (
          <div className="space-y-4">
            {/* Build Card */}
            <BuildCard />

            {/* Test Card */}
            {/* <TestCard /> */}

            {/* Publish Card */}
            {/* <PublishCard /> */}

            {/* Upgrade Card */}
            {/* <UpgradeCard /> */}

            {/* One-Click Workflow */}
            {/* <OneClickWorkflow /> */}
          </div>
        )}

        {/* Empty State */}
        {!currentPackage && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-6 p-6 bg-white/5 rounded-full">
              <Rocket className="h-12 w-12 text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No Package Selected
            </h3>
            <p className="text-gray-400 max-w-md">
              Select a Move package directory to get started with building, testing,
              and deploying your smart contracts.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <p className="text-xs text-gray-500">
            Move Development Studio v2.0
          </p>
          <button
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
