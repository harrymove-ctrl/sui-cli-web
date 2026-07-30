import { Fingerprint } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { type DerivedObjectKeyType, deriveObjectAddress } from '@/api/services/derivedObjects';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const KEY_TYPES: { value: DerivedObjectKeyType; label: string; placeholder: string }[] = [
  { value: 'address', label: 'address', placeholder: '0x...' },
  { value: 'u8', label: 'u8', placeholder: '0-255' },
  { value: 'u16', label: 'u16', placeholder: '0-65535' },
  { value: 'u32', label: 'u32', placeholder: 'integer' },
  { value: 'u64', label: 'u64', placeholder: 'integer' },
  { value: 'u128', label: 'u128', placeholder: 'integer' },
  { value: 'u256', label: 'u256', placeholder: 'integer' },
  { value: 'bool', label: 'bool', placeholder: 'true or false' },
  { value: 'string', label: 'String', placeholder: 'text' },
];

/** Sui's derived objects (https://docs.sui.io/develop/objects/derived-objects) have a
 * deterministic address computable from a parent id + key, entirely offchain - but
 * there's no generic on-chain signal to discover an *existing* one (the parent link
 * only proves uniqueness, per Sui's own docs). So this is a calculator, not a browser:
 * compute the address for a given parent+key, then jump straight to looking it up. */
export function DerivedObjectCalculator() {
  const navigate = useNavigate();
  const [parentId, setParentId] = useState('');
  const [keyType, setKeyType] = useState<DerivedObjectKeyType>('u64');
  const [keyValue, setKeyValue] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const selectedType = KEY_TYPES.find((t) => t.value === keyType) ?? KEY_TYPES[0];

  const handleCompute = async () => {
    setAddress(null);
    setIsComputing(true);
    try {
      const result = await deriveObjectAddress(parentId.trim(), keyType, keyValue.trim());
      setAddress(result.address);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to compute address');
    } finally {
      setIsComputing(false);
    }
  };

  const canCompute = parentId.trim().startsWith('0x') && keyValue.trim().length > 0 && !isComputing;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  // Copy-for-AI export of the derivation inputs and computed result.
  const aiExport = address
    ? {
        prompt: [
          `On Sui, I derived an object address from a parent object and a typed key.`,
          `- Parent object ID: ${parentId.trim()}`,
          `- Key type: ${keyType}`,
          `- Key value: ${keyValue.trim()}`,
          `- Derived object address: ${address}`,
          '',
          "This uses @mysten/sui's derived_object::derive_address. Explain how this address is computed and how I can use it.",
        ].join('\n'),
        json: JSON.stringify(
          {
            parentId: parentId.trim(),
            keyType,
            keyValue: keyValue.trim(),
            derivedAddress: address,
          },
          null,
          2
        ),
      }
    : null;

  return (
    <div className="px-3 py-3 space-y-4">
      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Derived Address Calculator</span>
          </div>
          {aiExport && (
            <CopyForAiMenu prompt={aiExport.prompt} json={aiExport.json} onCopy={copyToClipboard} />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Computes a derived object's deterministic address from its parent object ID and key - the
          same offchain hash Move's{' '}
          <code className="font-mono">derived_object::derive_address</code> uses onchain. Uses{' '}
          <code className="font-mono">@mysten/sui</code>'s official implementation, not a
          hand-rolled hash.
        </p>

        <div>
          <label htmlFor="derived-parent-id" className="text-xs text-muted-foreground mb-1 block">
            Parent object ID
          </label>
          <Input
            id="derived-parent-id"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            placeholder="0x... parent object ID"
            className="font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="derived-key-type" className="text-xs text-muted-foreground mb-1 block">
              Key type
            </label>
            <Select value={keyType} onValueChange={(v) => setKeyType(v as DerivedObjectKeyType)}>
              <SelectTrigger id="derived-key-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="derived-key-value" className="text-xs text-muted-foreground mb-1 block">
              Key value
            </label>
            <Input
              id="derived-key-value"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={selectedType.placeholder}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <Button onClick={handleCompute} disabled={!canCompute} className="w-full">
          {isComputing ? 'Computing…' : 'Compute address'}
        </Button>
      </div>

      {address && (
        <div className="p-4 rounded-lg border border-border bg-card space-y-2">
          <div className="text-xs text-muted-foreground">Derived address</div>
          <div className="text-sm font-mono text-foreground break-all">{address}</div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(address);
                toast.success('Address copied');
              }}
            >
              Copy
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/app/objects/${address}`)}>
              Look up this object
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
