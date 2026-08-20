-- CreateEnum
CREATE TYPE "DownloadType" AS ENUM ('PDF', 'MOBILE', 'DESKTOP');

-- CreateEnum
CREATE TYPE "DownloadPlatform" AS ENUM ('ANDROID', 'IOS', 'WINDOWS', 'LINUX', 'MACOS', 'OTHER');

-- CreateEnum
CREATE TYPE "DownloadStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "DownloadCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DownloadCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Download" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "DownloadType" NOT NULL,
    "platform" "DownloadPlatform" NOT NULL,
    "version" TEXT,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL DEFAULT '',
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "download_category_id" TEXT,
    "author_id" TEXT NOT NULL,
    "status" "DownloadStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DownloadLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "download_id" TEXT NOT NULL,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DownloadLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DownloadCategory_slug_key" ON "DownloadCategory"("slug");

-- CreateIndex
CREATE INDEX "DownloadCategory_status_idx" ON "DownloadCategory"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Download_slug_key" ON "Download"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Download_filename_key" ON "Download"("filename");

-- CreateIndex
CREATE INDEX "Download_status_idx" ON "Download"("status");

-- CreateIndex
CREATE INDEX "Download_type_idx" ON "Download"("type");

-- CreateIndex
CREATE INDEX "Download_platform_idx" ON "Download"("platform");

-- CreateIndex
CREATE INDEX "Download_download_category_id_idx" ON "Download"("download_category_id");

-- CreateIndex
CREATE INDEX "Download_author_id_idx" ON "Download"("author_id");

-- CreateIndex
CREATE INDEX "Download_created_at_idx" ON "Download"("created_at");

-- CreateIndex
CREATE INDEX "Download_deleted_at_idx" ON "Download"("deleted_at");

-- CreateIndex
CREATE INDEX "DownloadLog_user_id_idx" ON "DownloadLog"("user_id");

-- CreateIndex
CREATE INDEX "DownloadLog_download_id_idx" ON "DownloadLog"("download_id");

-- CreateIndex
CREATE INDEX "DownloadLog_created_at_idx" ON "DownloadLog"("created_at");

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_download_category_id_fkey" FOREIGN KEY ("download_category_id") REFERENCES "DownloadCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_download_id_fkey" FOREIGN KEY ("download_id") REFERENCES "Download"("id") ON DELETE CASCADE ON UPDATE CASCADE;
