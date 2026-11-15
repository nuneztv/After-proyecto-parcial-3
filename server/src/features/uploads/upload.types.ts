export interface UploadedImage {
  url: string;
}

// The subset of a multer file the service needs, so it does not depend on Express types
export interface ImageFile {
  buffer: Buffer;
  mimetype: string;
}
