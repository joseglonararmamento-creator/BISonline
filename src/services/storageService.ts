import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../firebase';

export interface UploadResult {
  url: string;
  name: string;
  size: number;
}

/**
 * Robust Upload Method with Progress
 */
export async function uploadWithProgress(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!storage) {
    throw new Error("Firebase Storage is not available.");
  }

  const result = await uploadFileDetailed(file, path, onProgress);
  return result.url;
}

/**
 * Detailed upload function returning metadata
 */
export async function uploadFileDetailed(
  file: File,
  path: string,
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  if (!storage) {
    throw new Error("Firebase Storage is not available.");
  }

  // Ensure user is authenticated if needed (usually required by rules)
  if (!auth.currentUser) {
    console.error('Upload blocked: No active user session');
    throw new Error('Unauthorized upload attempt');
  }

  return new Promise((resolve, reject) => {
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, `${path}/${timestamp}_${safeName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(Math.round(progress));
        },
        (error) => {
          console.error(`Upload to ${path} failed:`, error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              url: downloadURL,
              name: file.name,
              size: file.size
            });
          } catch (err) {
            console.error("URL retrieval failed:", err);
            reject(err);
          }
        }
      );
    } catch (err: any) {
      console.error("Upload initiation failed:", err);
      reject(err);
    }
  });
}
