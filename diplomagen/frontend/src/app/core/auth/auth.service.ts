import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, GoogleAuthProvider, signInWithPopup, signOut, user } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import type { User as FirebaseUser } from 'firebase/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);

  /** Observable of the current Firebase user (null = signed out) */
  readonly currentUser$: Observable<FirebaseUser | null> = user(this.auth);

  /** Emits true when the user is signed in */
  readonly isAuthenticated$: Observable<boolean> = this.currentUser$.pipe(
    map((u) => u !== null),
  );

  /** Returns the current user synchronously (may be null) */
  get currentUser(): FirebaseUser | null {
    return this.auth.currentUser;
  }

  /**
   * Gets a fresh Firebase ID token for the current user.
   * Returns null if no user is signed in.
   */
  async getIdToken(): Promise<string | null> {
    const u = this.auth.currentUser;
    if (!u) return null;
    return u.getIdToken();
  }

  /** Opens Google OAuth popup and signs the user in */
  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(this.auth, provider);
    await this.router.navigate(['/projects']);
  }

  /** Signs the user out and redirects to the login page */
  async signOut(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigate(['/login']);
  }

  /** Check if the current user has a Firestore user document */
  getUserProfile(): Observable<unknown> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Not authenticated');
    const ref = doc(this.firestore, `users/${uid}`);
    return from(getDoc(ref)).pipe(map((snap) => snap.data()));
  }
}
