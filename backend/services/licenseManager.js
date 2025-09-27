const os = require('os');
const fs = require('fs');
const path = path = require('path');
const crypto = require('crypto');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const INSTALL_DATE_FILE = path.join(CONFIG_DIR, 'install_date.txt');
const FINGERPRINT_FILE = path.join(CONFIG_DIR, 'fp.txt');
const LICENSE_FILE = path.join(CONFIG_DIR, 'license.lic');

const TRIAL_DAYS = 14;

// This would be embedded in your application, never stored in a file the user can modify.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAq/yB+...
-----END PUBLIC KEY-----`;


/**
 * Initializes the license manager on startup.
 * Creates config directory, install date, and fingerprint if they don't exist.
 */
function initialize() {
    try {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR);
        }
        // These files are created once and should never be deleted by the user.
        if (!fs.existsSync(INSTALL_DATE_FILE)) {
            fs.writeFileSync(INSTALL_DATE_FILE, new Date().toISOString());
        }
        if (!fs.existsSync(FINGERPRINT_FILE)) {
            const fp = generateMachineFingerprint();
            fs.writeFileSync(FINGERPRINT_FILE, fp);
        }
    } catch (error) {
        console.error("[LicenseManager] FATAL: Could not initialize configuration files.", error);
        process.exit(1);
    }
}

/**
 * Generates a unique fingerprint for the machine based on CPU and MAC address.
 * @returns {string} A SHA256 hash representing the machine fingerprint.
 */
function generateMachineFingerprint() {
    const cpus = os.cpus();
    const network = os.networkInterfaces();

    const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown_cpu';
    const macAddress = Object.values(network)
        .flat()
        .find(iface => iface && !iface.internal && iface.mac !== '00:00:00:00:00:00')?.mac || 'unknown_mac';
    
    const source = `${cpuModel}-${macAddress}`;
    return crypto.createHash('sha256').update(source).digest('hex');
}

/**
 * Reads the machine fingerprint from the stored file.
 * @returns {string} The machine fingerprint.
 */
function getMachineFingerprint() {
    try {
        return fs.readFileSync(FINGERPRINT_FILE, 'utf-8');
    } catch {
        // Fallback if file deleted, but initialize should prevent this.
        const fp = generateMachineFingerprint();
        fs.writeFileSync(FINGERPRINT_FILE, fp);
        return fp;
    }
}

/**
 * Retrieves the first installation date, crucial for anti-tampering.
 * @returns {Date} The installation date.
 */
function getInstallDate() {
    const dateString = fs.readFileSync(INSTALL_DATE_FILE, 'utf-8');
    return new Date(dateString);
}


/**
 * Gets the current status of the license.
 * This is the main function called by the API endpoint.
 * @returns {Promise<object>} A license status object.
 */
async function getLicenseStatus() {
    const machineFingerprint = getMachineFingerprint();
    const installDate = getInstallDate();
    const now = new Date();
    
    // Anti-tampering check: if current time is before install time, something is wrong.
    if (now < installDate) {
        return {
            machineFingerprint,
            status: 'INVALID',
            expiresAt: null,
            daysRemaining: null,
            limits: { agents: { current: 0, max: 0 }, channels: { current: 0, max: 0 } },
        };
    }
    
    // Check for a license file
    if (fs.existsSync(LICENSE_FILE)) {
        // In a real implementation, you would decrypt and verify the license here.
        // For now, we'll use a mock valid license.
        return {
            machineFingerprint,
            status: 'ACTIVE',
            expiresAt: new Date(now.setFullYear(now.getFullYear() + 1)).toISOString(),
            daysRemaining: 365,
            limits: { agents: { current: 5, max: 10 }, channels: { current: 8, max: 20 } },
        };
    }

    // Default to trial period
    const trialEndDate = new Date(installDate);
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);
    const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (daysRemaining <= 0) {
        return {
            machineFingerprint,
            status: 'EXPIRED',
            expiresAt: trialEndDate.toISOString(),
            daysRemaining: 0,
            limits: { agents: { current: 0, max: 999 }, channels: { current: 0, max: 999 } },
        };
    }

    return {
        machineFingerprint,
        status: 'TRIAL',
        expiresAt: trialEndDate.toISOString(),
        daysRemaining,
        limits: { agents: { current: 5, max: 999 }, channels: { current: 8, max: 999 } },
    };
}

/**
 * Activates a new license key.
 * @param {string} licenseKey - The base64 encoded license key.
 * @returns {Promise<object>} The new license details.
 */
async function activateLicense(licenseKey) {
    // In a real app:
    // 1. Base64 decode the key.
    // 2. Decrypt the content with the public key.
    // 3. Verify the signature.
    // 4. Check if the machine fingerprint matches.
    // 5. If all is valid, write the key to LICENSE_FILE.
    
    // For now, we simulate success.
    if (!licenseKey.startsWith("VALID_LICENSE_KEY_")) {
         throw new Error("La clé de licence fournie est invalide ou corrompue.");
    }
    fs.writeFileSync(LICENSE_FILE, licenseKey);
    return getLicenseStatus();
}

// --- STUBBED BLOCKING FUNCTIONS ---
// These are prepared but currently do nothing to block the app.

async function canAgentLogin() {
    // TODO: Implement actual logic
    // 1. Get current number of logged-in agents (from WebSocket clients or a session table).
    // 2. Get license status.
    // 3. Compare current agents vs license limit.
    // 4. Return { canLogin: false, reason: '...' } if limit is reached.
    return { canLogin: true };
}

async function canOriginateCall() {
    // TODO: Implement actual logic
    // 1. Get current number of active channels from AMI.
    // 2. Get license status.
    // 3. Compare current channels vs license limit.
    return { canCall: true };
}

function isApplicationLicensed() {
    // TODO: Implement actual logic
    // const status = await getLicenseStatus();
    // return status.status !== 'EXPIRED' && status.status !== 'INVALID';
    return true; // Always true for now
}

module.exports = {
    initialize,
    getLicenseStatus,
    activateLicense,
    canAgentLogin,
    canOriginateCall,
    isApplicationLicensed,
};
