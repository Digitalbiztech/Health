import { supabaseAdmin } from '../lib/supabase';

/**
 * Storage service to interact with Supabase Storage buckets.
 */
export class SupabaseStorageService {
  // Buckets we've already confirmed exist this process — avoids a listBuckets()
  // round-trip on every single upload.
  private static ensuredBuckets = new Set<string>();

  private static async ensureBucket(bucketName: string): Promise<void> {
    if (this.ensuredBuckets.has(bucketName)) {
      return;
    }
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      if (!buckets?.some((b) => b.name === bucketName)) {
        await supabaseAdmin.storage.createBucket(bucketName, {
          public: true, // Make public for easy access
          fileSizeLimit: 20 * 1024 * 1024, // 20MB limit
        });
      }
      this.ensuredBuckets.add(bucketName);
    } catch (err) {
      console.warn(`Failed bucket check/creation: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Build the public URL for a path WITHOUT uploading. The URL is deterministic
   * (it does not depend on the object existing yet), so callers can persist it
   * and respond before the bytes have finished uploading.
   */
  static getPublicUrl(bucketName: string, filePath: string): string {
    const { data } = supabaseAdmin.storage.from(bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  }

  /**
   * Upload a file buffer to a specific bucket.
   * Creates the bucket if it doesn't already exist.
   */
  static async uploadFile(
    bucketName: string,
    filePath: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.ensureBucket(bucketName);

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload to Supabase storage: ${error.message}`);
    }

    // Return the public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  /**
   * Delete a file from a specific bucket.
   */
  static async deleteFile(bucketName: string, filePath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete from Supabase storage: ${error.message}`);
    }
  }
}
