import mongoose from "mongoose";
import { errors } from "./Errors.js";

const getFormsBucket = () => {
  const db = mongoose.connection.db;
  if (!db) {
    throw errors.serverError("Database connection is not ready");
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "forms" });
};

const toObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    throw errors.badRequest("Invalid file id");
  }
};

export const uploadBufferToGridFS = ({ buffer, filename, contentType, metadata = {} }) =>
  new Promise((resolve, reject) => {
    const bucket = getFormsBucket();
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata,
    });

    uploadStream.end(buffer);

    uploadStream.on("finish", () => {
      resolve({
        fileId: uploadStream.id,
        fileName: filename,
        mimeType: contentType,
        size: buffer.length,
      });
    });

    uploadStream.on("error", (err) => {
      reject(err);
    });
  });

export const deleteGridFSFile = async (fileId) => {
  try {
    const bucket = getFormsBucket();
    await bucket.delete(toObjectId(fileId));
  } catch (err) {
    if (err?.message?.toLowerCase().includes("file not found")) {
      return;
    }
    throw err;
  }
};

export const openGridFSDownloadStream = (fileId) => {
  const bucket = getFormsBucket();
  return bucket.openDownloadStream(toObjectId(fileId));
};

export const getGridFSFileInfo = async (fileId) => {
  const bucket = getFormsBucket();
  const files = await bucket.find({ _id: toObjectId(fileId) }).limit(1).toArray();
  return files[0] || null;
};

