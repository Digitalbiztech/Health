import { env } from '../config/env.js';

// ─── Response shapes from the Python extraction service ──────
// Mirrors apps/extraction/app/models/{schemas,responses}.py

export type ExtractionFileType = 'application/pdf';

export interface ExtractionPageText {
  page: number;
  text: string;
}

export interface ExtractionPHIEntity {
  entity_type: string;
  start: number;
  end: number;
  text: string;
  score: number;
  source: string;
  token: string;
  page?: number | null;
}

export interface ExtractionRawBiomarker {
  name: string;
  value: string | number;
  unit: string;
}

export interface ExtractionNormalizedBiomarker {
  canonical_name: string;
  display_name: string;
  value: string;
  unit: string;
  reference_range: string;
  status: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  category: string;
  reference_min: number | null;
  reference_max: number | null;
}

export interface ExtractionInsight {
  id: string;
  title: string;
  body: string;
  tone: string;
}

export interface ExtractedData {
  text: string;
  masked_text: string;
  method: string;
  confidence: number;
  page_count: number;
  pages: ExtractionPageText[];
  masked_pages: ExtractionPageText[];
  phi_entities_count: number;
  phi_entities: ExtractionPHIEntity[];
  metadata: Record<string, unknown>;
  parsed_biomarkers: ExtractionRawBiomarker[];
  normalized_biomarkers: ExtractionNormalizedBiomarker[];
  insights: ExtractionInsight[];
}

export interface ExtractionResponse {
  success: boolean;
  upload_id: string;
  data: ExtractedData | null;
  error: string | null;
}

export interface ExtractionHealthResponse {
  status: string;
  service: string;
  biomarkers_loaded: number;
  presidio_available: boolean;
  openai_available: boolean;
  openai_model: string;
}

// ─── Client ──────────────────────────────────────────────────

export class ExtractionServiceError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ExtractionServiceError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.EXTRACTION_SERVICE_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.EXTRACTION_SERVICE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ExtractionServiceError(
        `Extraction service ${path} returned ${res.status}: ${body || res.statusText}`,
        res.status,
      );
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ExtractionServiceError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ExtractionServiceError(
        `Extraction service ${path} timed out after ${env.EXTRACTION_SERVICE_TIMEOUT_MS}ms`,
      );
    }
    throw new ExtractionServiceError(
      `Failed to reach extraction service: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const extractionService = {
  async extract(params: {
    fileUrl: string;
    fileType: ExtractionFileType;
    uploadId: string;
  }): Promise<ExtractionResponse> {
    return request<ExtractionResponse>('/extract', {
      method: 'POST',
      body: JSON.stringify({
        file_url: params.fileUrl,
        file_type: params.fileType,
        upload_id: params.uploadId,
      }),
    });
  },

  async health(): Promise<ExtractionHealthResponse> {
    return request<ExtractionHealthResponse>('/health', { method: 'GET' });
  },
};
