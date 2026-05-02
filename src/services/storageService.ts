import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import imageCompression from 'browser-image-compression';

/**
 * Uploads a file to Firebase Storage with progress tracking and automatic image compression.
 * @param file The file to upload
 * @param path The storage path (folder)
 * @param onProgress Callback function for upload progress (0-100)
 */
export async function uploadWithProgress(
  file: File,
  path: string,
  onProgress: (progress: number) => void
): Promise<string> {
  let fileToUpload = file;

  // 1. Browser-side Image Compression (Safe for Mobile)
  if (file.type.startsWith('image/')) {
    const options = {
      maxSizeMB: 0.8, // Target size under 1MB for mobile speed
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      initialQuality: 0.7
    };
    try {
      fileToUpload = await imageCompression(file, options);
    } catch (error) {
      console.warn('Compression failed, uploading original:', error);
    }
  }

  const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
  const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

  return new Promise((resolve, reject) => {
    // 2. 30-Second Timeout "Connection Slow" Guard
    const timeout = setTimeout(() => {
      uploadTask.cancel();
      reject(new Error('Connection slow: Upload timed out. Please check your signal.'));
    }, 30000);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(Math.round(progress));
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
      async () => {
        clearTimeout(timeout);
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}
