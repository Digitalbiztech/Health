-- CreateTable
CREATE TABLE "organization_brandings" (
    "id" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL DEFAULT 'Auriem',
    "tagline" TEXT,
    "powered_by_text" TEXT NOT NULL DEFAULT 'POWERED BY HUUMANIZE',
    "logo_main_url" TEXT,
    "logo_icon_url" TEXT,
    "logo_letterform_url" TEXT,
    "favicon_url" TEXT,
    "color_primary" TEXT NOT NULL DEFAULT '25 31% 75%',
    "color_primary_foreground" TEXT NOT NULL DEFAULT '0 0% 100%',
    "color_primary_text" TEXT NOT NULL DEFAULT '25 20% 48%',
    "color_primary_glow" TEXT NOT NULL DEFAULT '25 31% 75%',
    "color_accent" TEXT NOT NULL DEFAULT '30 11% 69%',
    "color_primary_dark" TEXT NOT NULL DEFAULT '27 15% 49%',
    "color_primary_fg_dark" TEXT NOT NULL DEFAULT '0 0% 100%',
    "color_primary_text_dark" TEXT NOT NULL DEFAULT '27 25% 65%',
    "color_accent_dark" TEXT NOT NULL DEFAULT '30 11% 45%',
    "pdf_accent_color" TEXT NOT NULL DEFAULT '#D4BDAD',
    "pdf_header_bg" TEXT NOT NULL DEFAULT '#1f2937',
    "pdf_theme_preset" TEXT NOT NULL DEFAULT 'warm-gold',
    "show_powered_by" BOOLEAN NOT NULL DEFAULT true,
    "custom_fonts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "font_family" TEXT,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_brandings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_brandings_organization_id_key" ON "organization_brandings"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_brandings" ADD CONSTRAINT "organization_brandings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
