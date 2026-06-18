-- Restore document_chunks + knowledge_base_chunks after migration
-- 20260618025738_documents_chunks_metadata accidentally dropped them. That drop
-- was auto-generated because these tables existed only as raw SQL and were not
-- modeled in schema.prisma; they are now Prisma models, so this won't recur.
--
-- NOTE: the dropped tables' data is unrecoverable. Document chunks repopulate as
-- reports are (re)ingested; reseed the knowledge base with `python seed_kb.py`.

CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "upload_id" TEXT,
    "extraction_id" TEXT,
    "chunk_type" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT,
    "report_type" TEXT,
    "report_date" TIMESTAMP(3),

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base_chunks" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_base_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (btree)
CREATE INDEX "document_chunks_patient_id_chunk_type_idx" ON "document_chunks"("patient_id", "chunk_type");
CREATE INDEX "document_chunks_organization_id_idx" ON "document_chunks"("organization_id");
CREATE INDEX "document_chunks_report_type_idx" ON "document_chunks"("report_type");
CREATE INDEX "document_chunks_report_date_idx" ON "document_chunks"("report_date");

-- CreateIndex (HNSW vector — not expressible in schema.prisma)
CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX "knowledge_base_chunks_embedding_idx" ON "knowledge_base_chunks" USING hnsw (embedding vector_cosine_ops);

-- CreateIndex (GIN on JSONB metadata)
CREATE INDEX "document_chunks_metadata_idx" ON "document_chunks" USING gin ("metadata");
CREATE INDEX "knowledge_base_chunks_metadata_idx" ON "knowledge_base_chunks" USING gin ("metadata");

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_extraction_id_fkey" FOREIGN KEY ("extraction_id") REFERENCES "extractions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
