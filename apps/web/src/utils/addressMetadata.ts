/**
 * Address Metadata Management
 * Handles labels, notes, and custom metadata for addresses
 */

export interface AddressMetadata {
  address: string;
  label?: string;
  notes?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'sui-address-metadata';

export class AddressMetadataStore {
  private static instance: AddressMetadataStore;
  private metadata: Map<string, AddressMetadata>;

  private constructor() {
    this.metadata = new Map();
    this.loadFromStorage();
  }

  static getInstance(): AddressMetadataStore {
    if (!AddressMetadataStore.instance) {
      AddressMetadataStore.instance = new AddressMetadataStore();
    }
    return AddressMetadataStore.instance;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: AddressMetadata[] = JSON.parse(stored);
        data.forEach((item) => {
          this.metadata.set(item.address, item);
        });
      }
    } catch (error) {
      console.error('Failed to load address metadata:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const data = Array.from(this.metadata.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save address metadata:', error);
    }
  }

  get(address: string): AddressMetadata | undefined {
    return this.metadata.get(address);
  }

  set(address: string, data: Partial<AddressMetadata>): void {
    const existing = this.metadata.get(address) || { address };
    const updated: AddressMetadata = {
      ...existing,
      ...data,
      address, // Always keep the address
      updatedAt: new Date().toISOString(),
    };
    if (!existing.createdAt) {
      updated.createdAt = new Date().toISOString();
    }
    this.metadata.set(address, updated);
    this.saveToStorage();
  }

  delete(address: string): void {
    this.metadata.delete(address);
    this.saveToStorage();
  }

  getAll(): AddressMetadata[] {
    return Array.from(this.metadata.values());
  }

  exportToJSON(): string {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      addresses: this.getAll(),
    };
    return JSON.stringify(data, null, 2);
  }

  importFromJSON(json: string): { success: boolean; imported: number; error?: string } {
    try {
      const data = JSON.parse(json);
      if (!data.addresses || !Array.isArray(data.addresses)) {
        return { success: false, imported: 0, error: 'Invalid format: missing addresses array' };
      }

      let imported = 0;
      data.addresses.forEach((item: AddressMetadata) => {
        if (item.address) {
          this.metadata.set(item.address, item);
          imported++;
        }
      });

      this.saveToStorage();
      return { success: true, imported };
    } catch (error) {
      return { success: false, imported: 0, error: String(error) };
    }
  }

  clear(): void {
    this.metadata.clear();
    this.saveToStorage();
  }
}

// Export singleton instance
export const addressMetadata = AddressMetadataStore.getInstance();
