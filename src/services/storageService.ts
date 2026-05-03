import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../firebase';

/**
 * RAW Fail-Safe Upload Method
 */
export async function uploadWithProgress(
  file: File,
  path: string,
  onProgress: (progress: number) => void
): Promise<string> {
  // Check auth first
  if (!auth.currentUser) {
    alert('Critical: No User Session. Please re-login.');
    throw new Error('No Auth');
  }

  alert('Step 1: File Preparation...');

  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
      alert('Step 2: Starting Upload to: ' + path);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(Math.round(progress));
        },
        (error) => {
          alert('Upload Error: ' + error.code);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            alert('Step 3: Success! URL Generated.');
            resolve(downloadURL);
          } catch (err) {
            alert('Step 3 Failed: URL Retrieval Error');
            reject(err);
          }
        }
      );
    } catch (err: any) {
      alert('Upload Initiation Failed: ' + err.message);
      reject(err);
    }
  });
}
