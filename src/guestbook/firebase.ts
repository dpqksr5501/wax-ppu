import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  startAfter,
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FIREBASE_CONFIG, CONFIG } from '../config.js';

export async function createFirebaseStore() {
  const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  let uid: string | undefined;
  if (import.meta.env.VITE_FIREBASE_ANONYMOUS_AUTH === 'true') {
    const { getAuth, signInAnonymously } = await import('firebase/auth');
    const auth = getAuth(app);
    if (!auth.currentUser) await signInAnonymously(auth);
    uid = auth.currentUser?.uid;
  }
  const db = getFirestore(app),
    messages = collection(db, 'guestbook');
  return {
    listen(
      accept: (docs: QueryDocumentSnapshot[], fromCache: boolean) => void,
      fail: (error: Error) => void,
    ) {
      return onSnapshot(
        query(
          messages,
          orderBy('timestamp', 'desc'),
          limit(CONFIG.guestbook.recentLimit),
        ),
        { includeMetadataChanges: true },
        (snapshot) => accept(snapshot.docs, snapshot.metadata.fromCache),
        fail,
      );
    },
    async page(cursor: QueryDocumentSnapshot) {
      return (
        await getDocs(
          query(
            messages,
            orderBy('timestamp', 'desc'),
            startAfter(cursor),
            limit(CONFIG.guestbook.pageSize),
          ),
        )
      ).docs;
    },
    createId() {
      return doc(messages).id;
    },
    save(id: string, value: { nickname: string; message: string }) {
      if (uid) {
        const batch = writeBatch(db);
        batch.set(doc(messages, id), {
          ...value,
          uid,
          timestamp: serverTimestamp(),
        });
        batch.set(doc(db, 'guestbookCooldowns', uid), {
          lastPostedAt: serverTimestamp(),
          entryId: id,
        });
        return batch.commit();
      }
      return setDoc(doc(messages, id), {
        ...value,
        timestamp: serverTimestamp(),
      });
    },
  };
}
