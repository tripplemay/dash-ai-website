/**
 * 存储抽象层。
 *
 * 当前实现：本地磁盘驱动 —— 资源文件放在 Next 的 public/ 下，
 * file_key 即 public 相对路径（如 files/海报/xxx.png），直接映射为站点 URL。
 *
 * 未来切换对象存储（COS/OSS/S3）时，新驱动实现同一接口：
 * resolveFileUrl 返回签名 URL、resolveFolderUrl 返回清单页或打包下载地址，
 * 调用方（/api/download、资源页）无需改动。
 */

export interface StorageDriver {
  /** file 型资源的下载/预览 URL */
  resolveFileUrl(fileKey: string): string;
  /** folder 型资源的打开地址（当前为 /api/browse 清单页） */
  resolveFolderUrl(fileKey: string): string;
}

const localDriver: StorageDriver = {
  resolveFileUrl: (fileKey) => `/${fileKey.replace(/^\//, "")}`,
  resolveFolderUrl: (fileKey) => `/api/browse/${fileKey.replace(/^\/+|\/+$/g, "")}/`,
};

export function getStorage(): StorageDriver {
  return localDriver;
}

/** 薄封装：file_key -> 站内可访问 URL */
export function resolvePublicUrl(fileKey: string): string {
  return localDriver.resolveFileUrl(fileKey);
}
