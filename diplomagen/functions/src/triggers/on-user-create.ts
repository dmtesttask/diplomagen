import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserRecord } from 'firebase-admin/auth';

/**
 * Firebase Auth trigger — runs when a new user registers.
 * Creates the Firestore user document with initial balance.
 */
export async function handleUserCreate(user: UserRecord): Promise<void> {
  try {
    await admin.firestore().collection('users').doc(user.uid).set({
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      availableGenerations: 1000, // TODO: set to 0 and require promo code activation before launch
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    console.log(`✅ Created Firestore user document for uid=${user.uid} (${user.email})`);
  } catch (err) {
    console.error(`❌ Failed to create user document for uid=${user.uid}:`, err);
    throw err; // Rethrow to trigger Cloud Functions retry logic
  }
}
