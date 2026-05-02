import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, where, getDocs, limit, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Confession, Comment } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Heart, MessageSquare, Image as ImageIcon, Trash2, Shield, User, Ghost, Clock, SendHorizontal, X } from 'lucide-react';
import { format } from 'date-fns';
import { uploadFile } from '../services/uploadService';

export default function Confessions() {
  const { profile } = useAuth();
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [text, setText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'confessions'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      setConfessions(snap.docs.map(d => ({ id: d.id, ...d.data() as object } as Confession)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !text.trim() || publishing) return;

    setPublishing(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        setUploadProgress(0);
        const result = await uploadFile(imageFile, 'confessions', (progress) => {
          setUploadProgress(progress);
        });
        imageUrl = result.url;
      }

      await addDoc(collection(db, 'confessions'), {
        authorId: profile.uid,
        authorName: isAnonymous ? 'Secret Shadow' : profile.displayName,
        authorPhoto: isAnonymous ? '' : profile.photoURL,
        text: text,
        imageUrl: imageUrl,
        isAnonymous: isAnonymous,
        likesCount: 0,
        createdAt: serverTimestamp()
      });

      setText('');
      setImageFile(null);
      setUploadProgress(null);
    } catch (err) {
      console.error("Publish error:", err);
      alert("Failed to post confession.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-[700px] mx-auto w-full space-y-8 pb-20">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
          <Shield size={14} className="text-indigo-400" />
          Secure & Private Room
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">The Safe Space</h1>
        <p className="text-slate-500 text-sm font-medium">Share your thoughts, worries, or happy moments anonymously.</p>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100 border border-slate-100">
        <div className="flex gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-all ${isAnonymous ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
            {isAnonymous ? <Ghost size={24} /> : <User size={24} />}
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                What are you thinking?
              </span>
              <div 
                onClick={() => setIsAnonymous(!isAnonymous)}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${isAnonymous ? 'text-indigo-600' : 'text-slate-400'}`}>
                  Post Anonymously
                </span>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${isAnonymous ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                  <motion.div 
                    animate={{ x: isAnonymous ? 22 : 2 }}
                    className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                  />
                </div>
              </div>
            </div>

            <textarea 
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={isAnonymous ? "Whisper your secret here..." : "Share your thoughts with the community..."}
              className="w-full min-h-[120px] p-0 border-none outline-none focus:ring-0 text-slate-800 text-lg font-medium placeholder:text-slate-300 resize-none"
            />

            {imageFile && (
              <div className="relative rounded-2xl overflow-hidden group">
                <img src={URL.createObjectURL(imageFile)} className="w-full h-48 object-cover" alt="Preview" />
                <button 
                  onClick={() => setImageFile(null)}
                  className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {uploadProgress !== null && (
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <button 
                type="button"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e: any) => setImageFile(e.target.files[0]);
                  input.click();
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                <ImageIcon size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Attach Media</span>
              </button>

              <button 
                onClick={handlePublish}
                disabled={publishing || !text.trim()}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 hover:bg-indigo-700 transition-all disabled:opacity-50 group active:scale-95"
              >
                {publishing ? 'Confessing...' : 'Confess Now'}
                <SendHorizontal size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <AnimatePresence>
          {confessions.map((confession) => (
            <ConfessionCard key={confession.id} confession={confession} currentProfile={profile} />
          ))}
        </AnimatePresence>
        
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gathering secrets...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfessionCard({ confession, currentProfile }: { confession: Confession, currentProfile: any }) {
  const [likes, setLikes] = useState(confession.likesCount || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!currentProfile || !confession.id) return;
    const checkLike = async () => {
      const likeDoc = await getDocs(query(
        collection(db, 'confession_likes'), 
        where('confessionId', '==', confession.id),
        where('userId', '==', currentProfile.uid)
      ));
      setHasLiked(!likeDoc.empty);
    };
    checkLike();

    const q = query(
      collection(db, 'comments'), 
      where('parentId', '==', confession.id),
      where('parentType', '==', 'confession'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() as object } as Comment)));
    });
  }, [confession.id, currentProfile]);

  const handleLike = async () => {
    if (!currentProfile || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const likeRef = doc(db, 'confession_likes', `${confession.id}_${currentProfile.uid}`);
      const confessionRef = doc(db, 'confessions', confession.id);

      if (hasLiked) {
        await deleteDoc(likeRef);
        await updateDoc(confessionRef, { likesCount: Math.max(0, (confession.likesCount || 0) - 1) });
        setLikes(prev => Math.max(0, prev - 1));
        setHasLiked(false);
      } else {
        await setDoc(likeRef, { userId: currentProfile.uid, confessionId: confession.id, createdAt: serverTimestamp() });
        await updateDoc(confessionRef, { likesCount: (confession.likesCount || 0) + 1 });
        setLikes(prev => prev + 1);
        setHasLiked(true);

        // Notify confession author if it's not self
        if (confession.authorId !== currentProfile.uid) {
          await addDoc(collection(db, 'notifications'), {
            userId: confession.authorId,
            type: 'confession_liked',
            authorId: currentProfile.uid,
            authorName: currentProfile.displayName,
            authorPhoto: currentProfile.photoURL,
            text: `${currentProfile.displayName} hearted your confession!`,
            isRead: false,
            createdAt: serverTimestamp(),
            link: '/confessions'
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !newComment.trim()) return;

    try {
      await addDoc(collection(db, 'comments'), {
        parentId: confession.id,
        parentType: 'confession',
        authorId: currentProfile.uid,
        authorName: currentProfile.displayName,
        authorPhoto: currentProfile.photoURL,
        text: newComment,
        isAnonymous: false,
        createdAt: serverTimestamp()
      });

      // Notify confession author if it's not self
      if (confession.authorId !== currentProfile.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: confession.authorId,
          type: 'confession_comment',
          authorId: currentProfile.uid,
          authorName: currentProfile.displayName,
          authorPhoto: currentProfile.photoURL,
          text: `${currentProfile.displayName} commented on your confession: "${newComment.substring(0, 30)}..."`,
          isRead: false,
          createdAt: serverTimestamp(),
          link: '/confessions'
        });
      }

      setNewComment('');
      setShowComments(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confession.isAnonymous ? 'bg-slate-900 text-slate-400' : 'bg-indigo-50 text-indigo-600'}`}>
              {confession.isAnonymous ? <Ghost size={20} /> : <User size={20} />}
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">{confession.authorName}</h4>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                <Clock size={10} />
                {confession.createdAt ? format(confession.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {confession.isAnonymous && (
              <div className="bg-indigo-50 px-3 py-1 rounded-full text-[9px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">
                Private Confession
              </div>
            )}
            {(currentProfile?.uid === confession.authorId || currentProfile?.role === 'teacher') && (
              <button 
                onClick={async () => {
                  if (confirm('Delete this confession?')) {
                    await deleteDoc(doc(db, 'confessions', confession.id));
                  }
                }}
                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{confession.text}</p>

        {confession.imageUrl && (
          <div className="rounded-2xl overflow-hidden border border-slate-100">
            <img src={confession.imageUrl} className="w-full max-h-[400px] object-cover" alt="Attached Media" />
          </div>
        )}

        <div className="flex items-center gap-6 pt-4 border-t border-slate-50">
          <button 
            onClick={handleLike}
            className={`flex items-center gap-2 group transition-colors ${hasLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-500'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${hasLiked ? 'bg-red-50' : 'group-hover:bg-red-50'}`}>
              <Heart size={18} fill={hasLiked ? "currentColor" : "none"} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-tighter">{likes} Hearts</span>
          </button>
          <button 
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-2 group transition-colors ${showComments ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}
          >
            <div className={`p-2 rounded-xl transition-all ${showComments ? 'bg-indigo-50' : 'group-hover:bg-indigo-50'}`}>
              <MessageSquare size={18} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-tighter">{comments.length} Comments</span>
          </button>
        </div>

        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-4"
            >
              <div className="pt-4 space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <img src={comment.authorPhoto || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-lg object-cover" alt="" />
                    <div className="flex-1 bg-slate-50 rounded-2xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="text-[10px] font-black text-slate-900">{comment.authorName}</h5>
                        <span className="text-[9px] text-slate-400 font-bold tracking-tight">
                          {comment.createdAt ? format(comment.createdAt.toDate(), 'h:mm a') : 'Now'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-3 pt-2">
                <img src={currentProfile?.photoURL || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-lg object-cover" alt="" />
                <div className="flex-1 relative">
                  <input 
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-4 text-xs pr-10 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                  />
                  <button 
                    disabled={!newComment.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 disabled:text-slate-300"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
