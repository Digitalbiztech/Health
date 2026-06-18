-- Adds filterable metadata to document_chunks and GIN indexes on the JSONB
-- metadata columns. document_chunks is managed via raw SQL (not a Prisma model),
-- so these changes live here rather than in schema.prisma.

-- AlterTable: filterable metadata columns (all nullable; populated best-effort)
ALTER TABLE "document_chunks"
    ADD COLUMN "organization_id" TEXT,
    ADD COLUMN "report_type" TEXT,
    ADD COLUMN "report_date" TIMESTAMP(3);

-- AddForeignKey: keep org-scoped chunks consistent with their organization
ALTER TABLE "document_chunks"
    ADD CONSTRAINT "document_chunks_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: btree indexes for the high-selectivity filter/order columns
CREATE INDEX "document_chunks_organization_id_idx" ON "document_chunks"("organization_id");
CREATE INDEX "document_chunks_report_type_idx" ON "document_chunks"("report_type");
CREATE INDEX "document_chunks_report_date_idx" ON "document_chunks"("report_date");

-- CreateIndex: GIN indexes so JSONB metadata can be filtered without a seq scan
CREATE INDEX "document_chunks_metadata_idx" ON "document_chunks" USING gin ("metadata");
CREATE INDEX "knowledge_base_chunks_metadata_idx" ON "knowledge_base_chunks" USING gin ("metadata");
