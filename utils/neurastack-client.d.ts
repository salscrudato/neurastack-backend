/**
 * TypeScript definitions for NeuraStack API Client
 */

export interface NeurastackClientConfig {
  baseUrl?: string;
  userId?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  apiKey?: string;
}

export interface RequestConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  correlationId?: string;
  [key: string]: any;
}

export interface ResponseData<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  responseTime: number;
  correlationId: string;
  attempt: number;
}

export interface ClientMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: number | null;
  successRate: string;
}

export interface ConfidenceScore {
  score: number;
  level: 'very-low' | 'low' | 'medium' | 'high';
  factors: string[];
}

export interface QualityMetrics {
  wordCount: number;
  sentenceCount: number;
  averageWordsPerSentence: number;
  hasStructure: boolean;
  hasReasoning: boolean;
  complexity: 'low' | 'medium' | 'high';
}

export interface RoleMetadata {
  processingTime: number;
  tokenCount: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface EnhancedRole {
  role: string;
  content: string;
  model: string;
  provider: string;
  status: 'fulfilled' | 'rejected';
  wordCount: number;
  confidence: ConfidenceScore;
  quality: QualityMetrics;
  metadata: RoleMetadata;
}

export interface SynthesisMetadata {
  basedOnResponses: number;
  averageConfidence: number;
  consensusLevel: 'insufficient-data' | 'low' | 'medium' | 'high';
}

export interface EnhancedSynthesis {
  content: string;
  model: string;
  provider: string;
  status: 'success' | 'failed';
  confidence: ConfidenceScore;
  qualityScore: number;
  metadata: SynthesisMetadata;
}

export interface ConfidenceAnalysis {
  overallConfidence: number;
  modelAgreement: number;
  responseConsistency: number;
  qualityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface CostEstimate {
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
  estimatedCost: string;
  modelsUsed: number;
}

export interface EnhancedEnsembleMetadata {
  totalRoles: number;
  successfulRoles: number;
  failedRoles: number;
  synthesisStatus: 'success' | 'failed';
  processingTimeMs: number;
  timestamp: string;
  version: string;
  correlationId: string;
  memoryContextUsed: boolean;
  responseQuality: number;
  confidenceAnalysis: ConfidenceAnalysis;
  costEstimate: CostEstimate;
}

export interface EnhancedEnsembleResponse {
  status: 'success' | 'error';
  data: {
    prompt: string;
    userId: string;
    synthesis: EnhancedSynthesis;
    roles: EnhancedRole[];
    metadata: EnhancedEnsembleMetadata;
  };
  timestamp: string;
  correlationId: string;
}

export interface UserMetadata {
  age: number;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  gender?: 'male' | 'female' | 'other';
  weight?: number;
  height?: number;
  goals?: string[];
  equipment?: string[];
  timeAvailable?: number;
  injuries?: string[];
  preferences?: string[];
}

export interface WorkoutHistoryItem {
  date: string;
  type: string;
  duration: number;
  exercises?: string[];
  difficulty?: string;
  rating?: number;
}

export interface WorkoutResponse {
  status: 'success' | 'error';
  data: {
    workout: any;
    metadata: {
      model: string;
      provider: string;
      timestamp: string;
      correlationId: string;
      userId: string;
    };
  };
  cached?: boolean;
  cacheTimestamp?: string;
  correlationId: string;
  timestamp: string;
}

export interface TierInfo {
  currentTier: 'free' | 'premium';
  configuration: {
    models: Record<string, any>;
    limits: any;
    estimatedCostPerRequest: string;
  };
  availableTiers: {
    free: any;
    premium: any;
  };
  costComparison: {
    free: any;
    premium: any;
  };
}

export interface CostEstimateRequest {
  prompt: string;
  tier?: 'free' | 'premium';
}

export interface CostEstimateResponse {
  status: 'success';
  data: {
    prompt: {
      length: number;
      estimatedTokens: number;
    };
    tier: string;
    estimatedCost: {
      total: string;
      breakdown: {
        promptTokens: number;
        responseTokens: number;
        modelsUsed: number;
      };
    };
    comparison: {
      free: string;
      premium: string;
    };
  };
  timestamp: string;
}

export type RequestInterceptor = (config: RequestConfig) => Promise<RequestConfig> | RequestConfig;
export type ResponseInterceptor = (response: ResponseData) => Promise<ResponseData> | ResponseData;

export class NeurastackError extends Error {
  status: number | null;
  data: any;
  correlationId: string | null;
  timestamp: string;

  constructor(message: string, status?: number | null, data?: any, correlationId?: string | null);
  toJSON(): object;
}

export class NeurastackClient {
  baseUrl: string;
  userId: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
  apiKey: string | null;
  metrics: ClientMetrics;

  constructor(config?: NeurastackClientConfig);

  addRequestInterceptor(interceptor: RequestInterceptor): void;
  addResponseInterceptor(interceptor: ResponseInterceptor): void;
  generateCorrelationId(): string;
  log(level: string, message: string, data?: any): void;
  sleep(ms: number): Promise<void>;
  makeRequest(endpoint: string, options?: RequestConfig): Promise<ResponseData>;
  updateMetrics(responseTime: number, success: boolean): void;
  getMetrics(): ClientMetrics;

  // API Methods
  healthCheck(): Promise<ResponseData>;
  enhancedEnsemble(prompt: string, options?: { sessionId?: string }): Promise<ResponseData<EnhancedEnsembleResponse>>;
  ensemble(prompt: string, options?: { sessionId?: string }): Promise<ResponseData>;
  generateWorkout(userMetadata: UserMetadata, workoutHistory?: WorkoutHistoryItem[], workoutRequest?: string, options?: RequestConfig): Promise<ResponseData<WorkoutResponse>>;
  estimateCost(prompt: string, tier?: string | null, options?: RequestConfig): Promise<ResponseData<CostEstimateResponse>>;
  getTierInfo(options?: RequestConfig): Promise<ResponseData<{ status: 'success'; data: TierInfo; timestamp: string }>>;
  getMetrics(options?: RequestConfig): Promise<ResponseData>;
  getCostAnalytics(options?: RequestConfig): Promise<ResponseData>;
  clearCache(options?: RequestConfig): Promise<ResponseData>;
}

export function createNeurastackClient(config?: NeurastackClientConfig): NeurastackClient;

export default NeurastackClient;
