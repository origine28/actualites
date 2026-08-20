-- CreateEnum
CREATE TYPE "VideoPlatform" AS ENUM ('YOUTUBE', 'VIMEO');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ArticleImage" (
    "article_id" TEXT NOT NULL,
    "image_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArticleImage_pkey" PRIMARY KEY ("article_id","image_id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL DEFAULT '',
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "variants" JSONB,
    "alt" TEXT NOT NULL DEFAULT '',
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "platform" "VideoPlatform" NOT NULL,
    "external_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail_image_id" TEXT,
    "category_id" TEXT,
    "author_id" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleImage_image_id_idx" ON "ArticleImage"("image_id");

-- CreateIndex
CREATE INDEX "ArticleImage_position_idx" ON "ArticleImage"("position");

-- CreateIndex
CREATE UNIQUE INDEX "Image_filename_key" ON "Image"("filename");

-- CreateIndex
CREATE INDEX "Image_uploaded_by_idx" ON "Image"("uploaded_by");

-- CreateIndex
CREATE INDEX "Image_created_at_idx" ON "Image"("created_at");

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "Video"("status");

-- CreateIndex
CREATE INDEX "Video_published_at_idx" ON "Video"("published_at");

-- CreateIndex
CREATE INDEX "Video_category_id_idx" ON "Video"("category_id");

-- CreateIndex
CREATE INDEX "Video_author_id_idx" ON "Video"("author_id");

-- CreateIndex
CREATE INDEX "Video_deleted_at_idx" ON "Video"("deleted_at");

-- Assainissement : neutralise les featured_image_id orphelins posés pendant la Phase 4
-- (avant l'ajout de la contrainte de clé étrangère).
UPDATE "Article" SET "featured_image_id" = NULL
WHERE "featured_image_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Image" WHERE "Image"."id" = "Article"."featured_image_id");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_featured_image_id_fkey" FOREIGN KEY ("featured_image_id") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleImage" ADD CONSTRAINT "ArticleImage_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleImage" ADD CONSTRAINT "ArticleImage_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_thumbnail_image_id_fkey" FOREIGN KEY ("thumbnail_image_id") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
