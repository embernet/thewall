// ---------------------------------------------------------------------------
// Tool Rate Limiter — Token bucket algorithm for tool call throttling
// ---------------------------------------------------------------------------

interface BucketConfig {
  /** Maximum tokens (calls) the bucket can hold. */
  maxTokens: number;
  /** Tokens added per second. */
  refillRate: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

// ---------------------------------------------------------------------------
// Default per-tool limits
// ---------------------------------------------------------------------------

const DEFAULT_LIMITS: Record<string, BucketConfig> = {
  // External search APIs (paid)
  web_search:       { maxTokens: 10, refillRate: 10 / 60 },
  patent_search:    { maxTokens: 10, refillRate: 10 / 60 },

  // External fetch (moderate)
  web_reader:       { maxTokens: 5, refillRate: 5 / 60 },
  pdf_to_markdown:  { maxTokens: 5, refillRate: 5 / 60 },

  // Free external APIs (generous)
  arxiv_search:     { maxTokens: 20, refillRate: 20 / 60 },
  academic_search:  { maxTokens: 20, refillRate: 20 / 60 },
  wikipedia_lookup: { maxTokens: 20, refillRate: 20 / 60 },

  // LLM-powered tools (cost-aware)
  text_summarizer:         { maxTokens: 10, refillRate: 10 / 60 },
  extract_structured_data: { maxTokens: 10, refillRate: 10 / 60 },

  // Local tools (fast)
  session_search:    { maxTokens: 30, refillRate: 30 / 60 },
  embeddings_ingest: { maxTokens: 30, refillRate: 30 / 60 },

  // Existing tools
  knowledge_graph_search: { maxTokens: 30, refillRate: 30 / 60 },
  knowledge_graph_add:    { maxTokens: 30, refillRate: 30 / 60 },
};

/** Global rate limit across all tools. */
const GLOBAL_LIMIT: BucketConfig = { maxTokens: 50, refillRate: 50 / 60 };
const GLOBAL_KEY = '__global__';

// ---------------------------------------------------------------------------
// RateLimiter
// ---------------------------------------------------------------------------

class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private limits: Record<string, BucketConfig>;

  constructor(limits?: Record<string, BucketConfig>) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  /**
   * Try to acquire a token for the given tool. Returns true if allowed.
   * If the tool has no configured limit, allows the call.
   */
  acquire(toolId: string): boolean {
    // Check per-tool limit
    if (!this.tryConsume(toolId, this.limits[toolId])) {
      return false;
    }
    // Check global limit
    if (!this.tryConsume(GLOBAL_KEY, GLOBAL_LIMIT)) {
      return false;
    }
    return true;
  }

  /** Get remaining tokens for a tool (for UI / diagnostics). */
  remaining(toolId: string): number {
    const config = this.limits[toolId];
    if (!config) return Infinity;
    const bucket = this.getBucket(toolId, config);
    this.refill(bucket, config);
    return Math.floor(bucket.tokens);
  }

  /** Reset all buckets (e.g. on session change). */
  reset(): void {
    this.buckets.clear();
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private tryConsume(key: string, config: BucketConfig | undefined): boolean {
    if (!config) return true; // No limit configured
    const bucket = this.getBucket(key, config);
    this.refill(bucket, config);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  private getBucket(key: string, config: BucketConfig): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: config.maxTokens, lastRefill: Date.now() };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  private refill(bucket: Bucket, config: BucketConfig): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate);
    bucket.lastRefill = now;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const rateLimiter = new RateLimiter();
