import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { commands } from './tauri.js';
import { appState } from './stores.svelte.js';

interface LicenseDoc {
	id: string;
	key: string;
	active: boolean;
	plan: string;
	hwid: string | null;
	expires_at: Timestamp;
	created_at: Timestamp;
	max_devices: number;
	last_validated?: Timestamp;
}

export async function validateLicense(licenseKey: string): Promise<boolean> {
	appState.setValidating(true);
	appState.setError('');

	try {
		// Get HWID from Tauri backend
		const { hwid } = await commands.getHwid();

		// Query Firestore for the license key
		const licensesRef = collection(db, 'licenses');
		const q = query(licensesRef, where('key', '==', licenseKey));
		const snapshot = await getDocs(q);

		if (snapshot.empty) {
			appState.setError('Invalid license key');
			return false;
		}

		const licenseDoc = snapshot.docs[0];
		const data = licenseDoc.data();
		const license: LicenseDoc = {
			id: licenseDoc.id,
			key: data.key,
			active: data.active,
			plan: data.plan,
			hwid: data.hwid ?? null,
			expires_at: data.expires_at,
			created_at: data.created_at,
			max_devices: data.max_devices ?? 1,
			last_validated: data.last_validated,
		};

		// Check if license is active (boolean field, not string)
		if (!license.active) {
			appState.setError('License is not active');
			return false;
		}

		// Check expiry (Firestore Timestamp → Date)
		if (license.expires_at) {
			const expiresAt = license.expires_at.toDate();
			if (expiresAt < new Date()) {
				appState.setError('License has expired');
				return false;
			}
		}

		// Check HWID binding
		if (license.hwid && license.hwid !== hwid) {
			appState.setError('License is bound to a different device');
			return false;
		}

		// Bind HWID on first activation (when hwid is null)
		if (!license.hwid) {
			try {
				await updateDoc(doc(db, 'licenses', license.id), {
					hwid: hwid,
					last_validated: Timestamp.now(),
				});
			} catch (bindErr) {
				console.warn('Failed to bind HWID (will retry next time):', bindErr);
				// Don't fail validation if binding fails
			}
		}

		// Format expiry for display
		const expiresAtStr = license.expires_at
			? license.expires_at.toDate().toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				})
			: 'Never';

		// Success — update app state
		appState.setLicenseKey(licenseKey);
		appState.setLicensed({
			plan: license.plan || 'standard',
			expiresAt: expiresAtStr,
		});

		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Validation failed';
		console.error('License validation error:', err);

		// Provide user-friendly error messages
		if (message.includes('network') || message.includes('fetch') || message.includes('Failed to get')) {
			appState.setError('No internet connection. License validation requires internet.');
		} else {
			appState.setError(message);
		}
		return false;
	} finally {
		appState.setValidating(false);
	}
}

export async function deactivateLicense(): Promise<void> {
	try {
		appState.logout();
	} catch (err) {
		console.error('Failed to deactivate license:', err);
	}
}
