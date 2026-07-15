import seedrandom from 'seedrandom';

export class RNG {
  private rng: seedrandom.PRNG;

  constructor(seed: number | string) {
    this.rng = seedrandom(seed.toString());
  }

  // Returns a float between 0 and 1
  nextFloat(): number {
    return this.rng();
  }

  // Returns an integer between min and max inclusive
  nextInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  // Returns a float between min and max
  nextRange(min: number, max: number): number {
    return this.rng() * (max - min) + min;
  }

  // Pick a random element from an array
  pick<T>(arr: T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    return arr[this.nextInt(0, arr.length - 1)];
  }
}
