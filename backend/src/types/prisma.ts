import type {
  ArticleImageModel,
  ArticleModel,
  ArticleTagModel,
  AuditLogModel,
  CategoryModel,
  DownloadCategoryModel,
  DownloadLogModel,
  DownloadModel,
  ImageModel,
  LoginLogModel,
  SessionModel,
  TagModel,
  UserModel,
  VideoModel,
} from '../generated/prisma/models.ts';

export type User = UserModel;
export type Session = SessionModel;
export type LoginLog = LoginLogModel;
export type AuditLog = AuditLogModel;
export type Category = CategoryModel;
export type Tag = TagModel;
export type Article = ArticleModel;
export type ArticleTag = ArticleTagModel;
export type ArticleImage = ArticleImageModel;
export type Image = ImageModel;
export type Video = VideoModel;
export type DownloadCategory = DownloadCategoryModel;
export type Download = DownloadModel;
export type DownloadLog = DownloadLogModel;
