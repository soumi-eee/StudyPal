import fs from 'fs/promises';
import path from 'path';

const DB_PATH = path.join(__dirname, '../data');

// Ensure data directory exists
async function initializeDb() {
  try {
    await fs.mkdir(DB_PATH, { recursive: true });
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Generic CRUD operations
export class JsonDB<T extends { id: string }> {
  private filename: string;
  private filepath: string;

  constructor(collection: string) {
    this.filename = `${collection}.json`;
    this.filepath = path.join(DB_PATH, this.filename);
    initializeDb();
  }

  private async readFile(): Promise<T[]> {
    try {
      const data = await fs.readFile(this.filepath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      await fs.writeFile(this.filepath, '[]');
      return [];
    }
  }

  private async writeFile(data: T[]): Promise<void> {
    await fs.writeFile(this.filepath, JSON.stringify(data, null, 2));
  }

  async findMany(filter: Partial<T> = {}): Promise<T[]> {
    const data = await this.readFile();
    return data.filter(item => 
      Object.entries(filter).every(([key, value]) => item[key as keyof T] === value)
    );
  }

  async findUnique(filter: Partial<T>): Promise<T | null> {
    const data = await this.readFile();
    return data.find(item => 
      Object.entries(filter).every(([key, value]) => item[key as keyof T] === value)
    ) || null;
  }

  async create(data: T): Promise<T> {
    const items = await this.readFile();
    items.push(data);
    await this.writeFile(items);
    return data;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const items = await this.readFile();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;

    items[index] = { ...items[index], ...data };
    await this.writeFile(items);
    return items[index];
  }

  async delete(id: string): Promise<boolean> {
    const items = await this.readFile();
    const filtered = items.filter(item => item.id !== id);
    if (filtered.length === items.length) return false;

    await this.writeFile(filtered);
    return true;
  }
} 