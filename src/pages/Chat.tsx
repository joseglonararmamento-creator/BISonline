import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, where, limit, getDocs, updateDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Message, UserProfile, Class } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Mic, 
  Image as ImageIcon, 
  Smile, 
  Users,
  Plus,
  StopCircle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronLeft,
  ShieldCheck,
  Paperclip,
  FileText,
  Download,
  Youtube,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { uploadFile } from '../services/uploadService';

function AudioPlayer({ src, isMine }: { src: string, isMine: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio ref={audioRef} src={src} className="hidden" />
      <button 
        onClick={togglePlay}
        className={`p-2 rounded-full transform active:scale-95 transition-all ${isMine ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="flex-1 space-y-1">
        <div 
          className={`h-1 w-full rounded-full cursor-pointer relative ${isMine ? 'bg-white/20' : 'bg-slate-100'}`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            if (audioRef.current) {
              audioRef.current.currentTime = pos * audioRef.current.duration;
            }
          }}
        >
          <div 
            className={`h-full rounded-full ${isMine ? 'bg-white' : 'bg-indigo-600'}`} 
            style={{ width: `${progress}%` }} 
          />
        </div>
        <div className="flex justify-between items-center">
          <span className={`text-[8px] font-bold uppercase ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}>
            {formatTime(audioRef.current?.currentTime || 0)} / {formatTime(duration || 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const { profile, isOnline } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [chatType, setChatType] = useState<'direct' | 'class'>('class');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState<number | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchParams] = useSearchParams();
  const deepLinkUserId = searchParams.get('userId');

  const emojiList = ['😀', '😂', '😍', '👍', '🔥', '📚', '✏️', '🎓'];

  useEffect(() => {
    const fetchUsers = async () => {
      const q = query(collection(db, 'users'), limit(100));
      const snap = await getDocs(q);
      const allUsers = snap.docs.map(d => d.data() as UserProfile).filter(u => u.uid !== profile?.uid);
      setUsers(allUsers);

      if (deepLinkUserId) {
        const targetUser = allUsers.find(u => u.uid === deepLinkUserId);
        if (targetUser) {
          setSelectedUser(targetUser);
          setChatType('direct');
          setShowSidebar(false);
        } else {
            // Might not be in the initial limit(100), fetch specifically
            try {
                const userDoc = await getDoc(doc(db, 'users', deepLinkUserId));
                if (userDoc.exists()) {
                    setSelectedUser(userDoc.data() as UserProfile);
                    setChatType('direct');
                    setShowSidebar(false);
                }
            } catch (err) {
                console.error("Deep link user fetch failed:", err);
            }
        }
      }
    };
    const fetchClasses = async () => {
      const q = query(collection(db, 'classes'));
      const snap = await getDocs(q);
      const allClassList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
      setClasses(allClassList);
      
      // Auto-select first joined class if none selected
      if (!selectedClassId) {
        if (profile?.classIds && profile.classIds.length > 0) {
          setSelectedClassId(profile.classIds[0]);
        } else if (profile?.role === 'teacher') {
          setSelectedClassId(TEACHERS_LOUNGE_ID);
        }
      }
    };
    fetchUsers();
    fetchClasses();
  }, [profile]);

  const TEACHERS_LOUNGE_ID = 'teachers-lounge';

  const joinedClasses = classes.filter(c => profile?.classIds?.includes(c.id) || profile?.role === 'teacher' && c.teacherId === profile.uid);
  
  // Inject Teachers Lounge if user is a teacher
  const displayJoinedClasses = profile?.role === 'teacher' 
    ? [{ id: TEACHERS_LOUNGE_ID, name: 'Teachers Lounge', teacherId: profile.uid }, ...joinedClasses]
    : joinedClasses;

  const otherClasses = classes.filter(c => !profile?.classIds?.includes(c.id) && !(profile?.role === 'teacher' && c.teacherId === profile.uid));

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredJoinedClasses = (displayJoinedClasses as (Class | {id: string, name: string, teacherId: string})[]).filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOtherClasses = otherClasses.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!profile) return;

    let q;
    if (chatType === 'class' && selectedClassId) {
      q = query(
        collection(db, 'messages'),
        where('classId', '==', selectedClassId),
        orderBy('createdAt', 'asc'),
        limit(100)
      );
    } else if (chatType === 'direct' && selectedUser) {
      // Direct messages are stored differently, let's keep the filter-based logic for now or improve storage
      q = query(
        collection(db, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(200)
      );
    } else {
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      let filtered: Message[] = [];
      
      if (chatType === 'direct' && selectedUser) {
        filtered = allMsgs.filter(m => 
          (m.senderId === profile.uid && m.receiverId === selectedUser.uid) ||
          (m.senderId === selectedUser.uid && m.receiverId === profile.uid)
        );
      } else {
        filtered = allMsgs;
      }

      setMessages(filtered);
      
      // Mark as read logic
      filtered.forEach(async (m) => {
        if (m.senderId !== profile.uid && (!m.readBy || !m.readBy.includes(profile.uid))) {
          const currentReadBy = m.readBy || [];
          await updateDoc(doc(db, 'messages', m.id), {
            readBy: [...currentReadBy, profile.uid]
          });
        }
      });
    });

    return unsubscribe;
  }, [selectedUser, selectedClassId, chatType, profile]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoinClass = async (classId: string) => {
    if (!profile || !isOnline) return;
    try {
      const currentIds = profile.classIds || [];
      if (currentIds.includes(classId)) return;
      
      const newIds = [...currentIds, classId];
      await updateDoc(doc(db, 'users', profile.uid), {
        classIds: newIds
      });
      alert('Joined class successfully!');
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSendMessage = async (e?: React.FormEvent, media?: { type: 'image' | 'audio' | 'file', url: string, name?: string, size?: number }) => {
    e?.preventDefault();
    if (!profile) return;
    if (!newMessage.trim() && !media) return;

    try {
      const payload: any = {
        senderId: profile.uid,
        createdAt: serverTimestamp(),
        readBy: [profile.uid]
      };

      if (chatType === 'class') {
        if (!selectedClassId) return;
        payload.classId = selectedClassId;
      } else {
        if (!selectedUser) return;
        payload.receiverId = selectedUser.uid;
      }

      if (media) {
        payload.mediaUrl = media.url;
        payload.mediaType = media.type;
        if (media.type === 'file') {
          payload.fileName = media.name;
          payload.fileSize = media.size;
        }
      } else {
        payload.text = newMessage;
        
        // YouTube Integration: Detect YouTube link
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([^&?\s]+)/;
        const match = newMessage.match(youtubeRegex);
        if (match && match[1]) {
          const videoId = match[1];
          try {
            // Simple metadata fetch via oembed
            const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            if (response.ok) {
              const data = await response.json();
              payload.youtubeMetadata = {
                videoId: videoId,
                title: data.title,
                thumbnailUrl: data.thumbnail_url
              };
            } else {
              // Fallback if oembed fails
              payload.youtubeMetadata = {
                videoId: videoId,
                title: "YouTube Video",
                thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
              };
            }
          } catch (err) {
            console.warn("YouTube metadata fetch failed:", err);
            payload.youtubeMetadata = {
              videoId: videoId,
              title: "YouTube Video",
              thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
            };
          }
        }
      }

      const docRef = await addDoc(collection(db, 'messages'), payload);
      setNewMessage('');
      setAudioBlob(null);

      // Undo logic
      setLastMessageId(docRef.id);
      setShowUndo(true);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = setTimeout(() => setShowUndo(false), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUndo = async () => {
    if (!lastMessageId) return;
    try {
      await deleteDoc(doc(db, 'messages', lastMessageId));
      setLastMessageId(null);
      setShowUndo(false);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !profile) return;

    const reactions = { ...(msg.reactions || {}) };
    const usersForEmoji = reactions[emoji] || [];
    
    if (usersForEmoji.includes(profile.uid)) {
      reactions[emoji] = usersForEmoji.filter(uid => uid !== profile.uid);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...usersForEmoji, profile.uid];
    }

    try {
      await updateDoc(doc(db, 'messages', messageId), { reactions });
      setShowReactionPicker(null);
    } catch (err) {
      console.error(err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        setAudioBlob(blob);
        const reader = new FileReader();
        reader.onloadend = () => {
          handleSendMessage(undefined, { type: 'audio', url: reader.result as string });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploadingProgress(0);
    try {
      const { uploadWithProgress } = await import('../services/storageService');
      const url = await uploadWithProgress(file, `chats/${chatType === 'class' ? selectedClassId : 'direct'}`, (progress) => {
        setUploadingProgress(progress);
      });
      
      await handleSendMessage(undefined, { 
        type: 'file', 
        url: url,
        name: file.name,
        size: file.size
      });
    } catch (err) {
      console.error("File upload failed:", err);
      alert("Failed to upload file.");
    } finally {
      setUploadingProgress(null);
      if (e.target) e.target.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploadingProgress(0);
    try {
      const { uploadWithProgress } = await import('../services/storageService');
      const url = await uploadWithProgress(file, `chats/images`, (progress) => {
        setUploadingProgress(progress);
      });
      
      await handleSendMessage(undefined, { 
        type: 'image', 
        url: url
      });
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Failed to upload image.");
    } finally {
      setUploadingProgress(null);
      if (e.target) e.target.value = '';
    }
  };

  const isMessageRead = (m: Message) => {
    return m.readBy && m.readBy.length > 1;
  };

  const activeClassName = selectedClassId === TEACHERS_LOUNGE_ID ? 'Teachers Lounge' : (classes.find(c => c.id === selectedClassId)?.name || 'Classroom');

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)] relative flex-col md:flex-row">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-80 border-r border-slate-100 flex-col bg-slate-50/50 absolute md:relative inset-0 z-20 md:z-auto h-full flex-col`}>
        <div className="p-4 md:p-6 shrink-0">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Messaging</h3>
          
          <div className="flex bg-slate-200/50 p-1 rounded-xl mb-4">
            <button 
              onClick={() => { setChatType('class'); setSelectedUser(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${chatType === 'class' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Classes
            </button>
            <button 
              onClick={() => { setChatType('direct'); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${chatType === 'direct' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Direct
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none shadow-sm focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4 custom-scrollbar">
          {chatType === 'class' ? (
            <div className="space-y-4">
              {/* Joined Classes */}
              <div className="px-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">My Classes</p>
                <div className="space-y-1">
                  {filteredJoinedClasses.map(cls => (
                    <button 
                      key={cls.id}
                      onClick={() => {
                        setSelectedClassId(cls.id);
                        setShowSidebar(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                        selectedClassId === cls.id && !selectedUser
                        ? 'bg-white shadow-md border-indigo-100 ring-1 ring-indigo-50 font-bold text-indigo-600' 
                        : 'hover:bg-white/60 text-slate-600'
                      }`}
                    >
                      <div className={`w-10 h-10 ${cls.id === TEACHERS_LOUNGE_ID ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'} flex items-center justify-center rounded-xl shadow-inner shrink-0`}>
                        {cls.id === TEACHERS_LOUNGE_ID ? <ShieldCheck size={18} /> : <Users size={18} />}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-sm truncate">{cls.name}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-black truncate">
                          {cls.id === TEACHERS_LOUNGE_ID ? 'Admin Only' : (cls.teacherId === profile?.uid ? 'Teacher' : 'Joined')}
                        </p>
                      </div>
                    </button>
                  ))}
                  {filteredJoinedClasses.length === 0 && (
                    <p className="text-xs text-slate-400 p-2 italic">None joined yet.</p>
                  )}
                </div>
              </div>

              {/* Discovery Classes */}
              {searchQuery && filteredOtherClasses.length > 0 && (
                <div className="px-4 border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Discover Classes</p>
                  <div className="space-y-2">
                    {filteredOtherClasses.map(cls => (
                      <div key={cls.id} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{cls.name}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">Code: {cls.inviteCode}</p>
                        </div>
                        <button 
                          onClick={() => handleJoinClass(cls.id)}
                          className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            filteredUsers.map(u => {
              const lastMsg = messages.filter(m => (m.senderId === u.uid) || (m.receiverId === u.uid)).pop();
              const unread = messages.filter(m => m.senderId === u.uid && (!m.readBy || !m.readBy.includes(profile?.uid || ''))).length;
              
              return (
                <button 
                  key={u.uid}
                  onClick={() => {
                    setSelectedUser(u);
                    setShowSidebar(false);
                  }}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all group ${
                    selectedUser?.uid === u.uid 
                    ? 'bg-white shadow-md border-indigo-100 ring-1 ring-indigo-50 text-indigo-600' 
                    : 'hover:bg-white/60 text-slate-600'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={u.photoURL || `https://ui-avatars.com/api/?name=${u.displayName}`} className="w-12 h-12 rounded-2xl shadow-sm" alt="" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-bold truncate">{u.displayName}</p>
                      {unread > 0 && (
                        <span className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-white">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] uppercase font-black tracking-widest opacity-50 truncate">{lastMsg?.text || u.role}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-white overflow-hidden ${!showSidebar ? 'flex' : 'hidden'} md:flex`}>
        {( (chatType === 'class' && selectedClassId) || (chatType === 'direct' && selectedUser) ) ? (
          <>
            <div className="h-20 border-b border-slate-100 px-4 md:px-6 flex items-center justify-between bg-white z-10 shadow-sm shadow-slate-100/50">
              <div className="flex items-center gap-2 md:gap-3">
                <button 
                  onClick={() => setShowSidebar(true)}
                  className="md:hidden p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl mr-1"
                >
                  <ChevronLeft size={24} />
                </button>
                {chatType === 'class' ? (
                  <div className={`w-10 h-10 ${selectedClassId === TEACHERS_LOUNGE_ID ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'} rounded-xl flex items-center justify-center shrink-0`}>
                    {selectedClassId === TEACHERS_LOUNGE_ID ? <ShieldCheck size={20} /> : <Users size={20} />}
                  </div>
                ) : (
                  <img src={selectedUser?.photoURL || `https://ui-avatars.com/api/?name=${selectedUser?.displayName}`} className="w-10 h-10 rounded-xl shadow-sm shrink-0" alt="" />
                )}
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 truncate max-w-[120px] sm:max-w-[200px]">{chatType === 'class' ? activeClassName : selectedUser?.displayName}</h4>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{chatType === 'class' ? 'Classroom' : 'Online'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <button className="p-2 md:p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all">
                  <Phone size={18} />
                </button>
                <button className="p-2 md:p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all">
                  <Video size={18} />
                </button>
                <button className="hidden sm:block p-2 md:p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
              {messages.map((m, index) => {
                const isMine = m.senderId === profile?.uid;
                const sender = users.find(u => u.uid === m.senderId);
                const showDate = index === 0 || 
                  (m.createdAt && messages[index-1].createdAt && 
                  format(m.createdAt.toDate(), 'yyyy-MM-dd') !== format(messages[index-1].createdAt.toDate(), 'yyyy-MM-dd'));

                return (
                  <div key={m.id}>
                    {showDate && (
                      <div className="flex justify-center my-8">
                        <span className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">
                          {m.createdAt ? format(m.createdAt.toDate(), 'MMMM d, yyyy') : 'Today'}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col relative`}>
                        {!isMine && chatType === 'class' && (
                          <span className="text-[10px] font-bold text-slate-500 ml-2 mb-1 flex items-center gap-1 group">
                             {sender?.displayName || 'Member'}
                             <span className="w-0.5 h-0.5 bg-slate-300 rounded-full" />
                             <span className="text-slate-400 text-[9px] uppercase tracking-tighter">{sender?.role}</span>
                          </span>
                        )}
                        
                        <div className={`group relative transition-all duration-200 ${isMine ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                            isMine 
                              ? 'bg-indigo-600 text-white rounded-br-none hover:bg-indigo-700' 
                              : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none hover:border-indigo-100'
                          }`}>
                            {m.mediaType === 'image' && (
                              <div className="mb-2 relative group overflow-hidden rounded-xl bg-slate-100 min-h-[100px] flex items-center justify-center">
                                <img src={m.mediaUrl} className="max-w-full shadow-sm hover:scale-105 transition-transform cursor-pointer" alt="Uploaded" loading="lazy" />
                              </div>
                            )}
                            {m.mediaType === 'file' && (
                              <div className={`mb-3 p-3 rounded-xl border flex items-center gap-3 ${isMine ? 'bg-indigo-700/50 border-white/20' : 'bg-slate-50 border-slate-200'}`}>
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMine ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                  <FileText size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-bold truncate ${isMine ? 'text-white' : 'text-slate-900'}`}>{m.fileName}</p>
                                  <p className={`text-[9px] font-black uppercase tracking-tight ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}>
                                    {(m.fileSize || 0) > 1024 * 1024 
                                      ? `${((m.fileSize || 0) / (1024 * 1024)).toFixed(1)} MB` 
                                      : `${((m.fileSize || 0) / 1024).toFixed(1)} KB`}
                                  </p>
                                </div>
                                <a 
                                  href={m.mediaUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className={`p-2 rounded-lg transition-all ${isMine ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white border border-slate-200 text-indigo-600 hover:bg-slate-50 shadow-sm'}`}
                                >
                                  <Download size={16} />
                                </a>
                              </div>
                            )}
                            {m.youtubeMetadata && (
                              <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 bg-black group relative">
                                <div className="aspect-video w-full bg-slate-900 flex items-center justify-center relative">
                                  <iframe 
                                    className="absolute inset-0 w-full h-full"
                                    src={`https://www.youtube.com/embed/${m.youtubeMetadata.videoId}`}
                                    title={m.youtubeMetadata.title}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                                <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                                      <Youtube size={16} />
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-900 truncate">{m.youtubeMetadata.title}</p>
                                  </div>
                                  <a 
                                    href={`https://youtube.com/watch?v=${m.youtubeMetadata.videoId}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                              </div>
                            )}
                            {m.mediaType === 'audio' && (
                              <AudioPlayer src={m.mediaUrl || ''} isMine={isMine} />
                            )}
                            {m.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>}

                            {/* Reactions display */}
                            {m.reactions && Object.keys(m.reactions).length > 0 && (
                              <div className={`absolute -bottom-4 ${isMine ? 'right-0' : 'left-0'} flex flex-wrap gap-1 z-10`}>
                                {Object.entries(m.reactions).map(([emoji, userList]) => {
                                  const hasReacted = userList.includes(profile?.uid || '');
                                  return (
                                    <button 
                                      key={emoji}
                                      onClick={() => handleAddReaction(m.id, emoji)}
                                      className={`px-2 py-0.5 bg-white border rounded-full shadow-sm text-xs flex items-center gap-1.5 hover:scale-105 transition-all active:scale-95 ${
                                        hasReacted 
                                          ? 'border-indigo-200 bg-indigo-50/50 text-indigo-700 font-bold' 
                                          : 'border-slate-100 text-slate-500 hover:border-slate-200'
                                      }`}
                                    >
                                      <span className="text-[14px]">{emoji}</span>
                                      <span className="text-[10px] tabular-nums">{userList.length}</span>
                                    </button>
                                  );
                                })}
                                <button 
                                  onClick={() => setShowReactionPicker(showReactionPicker === m.id ? null : m.id)}
                                  className="w-6 h-6 flex items-center justify-center bg-white border border-slate-100 rounded-full shadow-sm text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                >
                                  <Plus size={10} />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          {/* Reaction hover button (Visible on hover for desktop, always visible for mobile if no reactions) */}
                          <div className={`absolute ${isMine ? '-left-10' : '-right-10'} top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 md:opacity-0 transition-opacity duration-200`}>
                            <button 
                              onClick={() => setShowReactionPicker(showReactionPicker === m.id ? null : m.id)}
                              className="p-1.5 bg-white border border-slate-100 rounded-full shadow-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 transition-all"
                            >
                              <Smile size={14} />
                            </button>
                          </div>
                          
                          <AnimatePresence>
                            {showReactionPicker === m.id && (
                              <>
                                <motion.div 
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  onClick={() => setShowReactionPicker(null)}
                                  className="fixed inset-0 z-30"
                                />
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                  className={`absolute z-40 bottom-full mb-3 p-2 bg-white border border-slate-100 rounded-2xl shadow-2xl flex gap-1.5 items-center ${isMine ? 'right-0' : 'left-0'} ring-1 ring-black/5`}
                                >
                                  {emojiList.map(emoji => (
                                    <button 
                                      key={emoji}
                                      onClick={() => handleAddReaction(m.id, emoji)}
                                      className="w-9 h-9 flex items-center justify-center hover:bg-indigo-50 rounded-xl transition-all hover:scale-125 transform active:scale-95"
                                    >
                                      <span className="text-xl leading-none">{emoji}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className={`flex items-center gap-3 mt-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`flex items-center gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">
                              {m.createdAt ? format(m.createdAt.toDate(), 'h:mm a') : 'Sending...'}
                            </span>
                            {isMine && m.createdAt && (
                              <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${isMessageRead(m) ? 'text-emerald-500' : 'text-slate-300'}`}>
                                {isMessageRead(m) ? 'Seen' : 'Delivered'}
                              </span>
                            )}
                          </div>

                          <button 
                            onClick={() => setShowReactionPicker(showReactionPicker === m.id ? null : m.id)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-slate-100 transition-all ${showReactionPicker === m.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-300 hover:text-indigo-600'}`}
                          >
                            <Smile size={10} />
                            <span className="text-[8px] font-black uppercase tracking-widest">React</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            <div className="p-3 md:p-6 border-t border-slate-100 bg-white shadow-lg relative">
              <AnimatePresence>
                {showUndo && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute bottom-full left-6 mb-4 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-4 z-50 ring-2 ring-white/10"
                  >
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-0.5">Notification</span>
                      <span className="text-[10px] font-bold tracking-tight">Message Sent Successfully</span>
                    </div>
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <button 
                      onClick={handleUndo}
                      className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-2 group"
                    >
                      Undo Send
                      <span className="w-5 h-5 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-all">
                        <X size={10} className="rotate-0 group-hover:rotate-90 transition-transform" />
                      </span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              {uploadingProgress !== null && (
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Uploading File...</p>
                    <p className="text-[10px] font-black text-indigo-600">{Math.round(uploadingProgress)}%</p>
                  </div>
                  <div className="h-1.5 w-full bg-indigo-50 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadingProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-1 md:gap-2 items-center bg-slate-50 p-1.5 md:p-2 rounded-2xl border border-slate-200 shadow-inner focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                <div className="flex items-center">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 md:p-3 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-sm shrink-0"
                  >
                    <ImageIcon size={18} />
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.pdf,.ppt,.pptx,.doc,.docx,.zip';
                      input.onchange = (e: any) => handleFileUpload(e);
                      input.click();
                    }}
                    className="p-2 md:p-3 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-sm shrink-0"
                  >
                    <Paperclip size={18} />
                  </button>
                </div>
                
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type..."
                  className="flex-1 bg-transparent px-2 md:px-4 outline-none text-slate-700 text-sm font-medium min-w-0"
                />

                <button 
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={isRecording ? stopRecording : undefined}
                  className={`p-2 md:p-3 rounded-xl transition-all shadow-none hover:shadow-sm shrink-0 ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-red-200' : 'text-slate-400 hover:text-indigo-600 hover:bg-white'}`}
                >
                  <Mic size={18} />
                </button>

                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 md:p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale transition-all shadow-lg shadow-indigo-100 shrink-0"
                >
                  <Send size={18} />
                </button>
              </form>
              <div className="flex justify-between items-center mt-2 px-1">
                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest italic truncate mr-2">Hold Mic to record</p>
                <button 
                   onClick={() => setNewMessage('')}
                   className="text-[9px] md:text-[10px] text-slate-300 hover:text-red-400 font-bold uppercase tracking-widest shrink-0"
                >
                  Clear
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30">
            <div className="w-24 h-24 bg-white rounded-[32px] shadow-sm flex items-center justify-center mb-6">
              <Users size={48} className="text-indigo-100" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-1">Your Classroom Hub</h4>
            <p className="text-sm max-w-xs text-center leading-relaxed">Collaborate with peers and instructors in real-time. Join a class or search for others to begin.</p>
            {chatType === 'class' && (
              <div className="mt-8 p-4 bg-white rounded-2xl border border-slate-100 max-w-xs w-full shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-indigo-600">
                  <Search size={16} />
                  <p className="text-xs font-black uppercase tracking-widest">Quick Join</p>
                </div>
                <p className="text-[10px] text-slate-500 mb-3 leading-tight">Use the search bar in the sidebar to find and join a class using its name.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

