import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadFile(
  file: File, 
  path: string, 
  onProgress?: (progress: number) => void
): Promise<{ url: string, name: string, size: number }> {
  if (!storage) {
    throw new Error("Firebase Storage is not available.");
  }

  return new Promise((resolve, reject) => {
    // Generate a unique file name
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const storageRef = ref(storage, `${path}/${timestamp}_${safeName}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
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
          reject(err);
        }
      }
    );
  });
}
