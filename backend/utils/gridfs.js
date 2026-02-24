// Gridfs: Module level logic for the feature area.
import mongoose from "mongoose";
import { errors } from "./Errors.js";

// Get Forms Bucket: Gets forms bucket from persistence or request payload. Inputs: none. Returns: a Promise with payload data.
const getFormsBucket = () => {
  const db = mongoose.connection.db;
  if (!db) {
    throw errors.serverError("Database connection is not ready");
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "forms" });
};

// To Object Id: Converts string ids to ObjectId types for persistence logic. Inputs: value. Returns: a function result.
const toObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    throw errors.badRequest("Invalid file id");
  }
};

// Upload Buffer To Grid FS: Writes a memory buffer to GridFS and returns storage metadata. Inputs: {, filename, contentType, metadata. Returns: a function result.
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

// Delete Grid FSFile: Deletes grid fsfile from persistent storage. Inputs: fileId. Returns: side effects and response to caller.
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

// Open Grid FSDownload Stream: Runs Open grid fsdownload stream flow. Inputs: fileId. Returns: a function result.
export const openGridFSDownloadStream = (fileId) => {
  const bucket = getFormsBucket();
  return bucket.openDownloadStream(toObjectId(fileId));
};

// Get Grid FSFile Info: Gets grid fsfile info from persistence or request payload. Inputs: fileId. Returns: a Promise with payload data.
export const getGridFSFileInfo = async (fileId) => {
  const bucket = getFormsBucket();
  const files = await bucket.find({ _id: toObjectId(fileId) }).limit(1).toArray();
  return files[0] || null;
};

