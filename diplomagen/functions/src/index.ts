import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2/https';
import * as auth from 'firebase-functions/v1/auth';
import { app } from './app';
import { handleUserCreate } from './triggers/on-user-create';

// Initialize Firebase Admin SDK
admin.initializeApp();

// ─── HTTP API ────────────────────────────────────────────────────────────────
export const api = functions.onRequest(
  {
    region: 'europe-central2',
    cors: process.env['ALLOWED_ORIGIN'] ? [process.env['ALLOWED_ORIGIN']] : true,
    memory: '512MiB',
    timeoutSeconds: 120,
    minInstances: 0,
  },
  app,
);

// ─── Auth Trigger (v1) ────────────────────────────────────────────────────────
// Note: Firebase Auth triggers use v1 API. The Firestore user doc is created
// here to ensure it exists before the first API call.
export const onUserCreate = auth.user().onCreate(handleUserCreate);
