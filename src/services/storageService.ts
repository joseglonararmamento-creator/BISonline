import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import imageCompression from 'browser-image-compression';

export async function uploadWithProgress(
  file: File,
  path: string,
  onProgress: (progress: number) => void
): Promise<string> {
  let fileToUpload = file;

  // Compress image if applicable
  if (file.type.startsWith('image/')) {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
    try {
      fileToUpload = await imageCompression(file, options);
    } catch (error) {
      console.error('Compression error:', error);
      // Fallback to original file
    }
  }

  const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
  const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      uploadTask.cancel();
      reject(new Error('Connection slow: Upload timed out after 30 seconds.'));
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
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}
